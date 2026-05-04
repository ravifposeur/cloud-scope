import os
import uuid
import shutil
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException, status
from celery.result import AsyncResult

from app.tasks import process_microscopy_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CloudScope API",
    description="API Gateway untuk platform analisis citra mikroskop berbasis cloud.",
    version="0.1.0",
)

TEMP_BASE_DIR = "/tmp/cloudscope"
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB

# Pastikan direktori temp ada saat aplikasi start
os.makedirs(TEMP_BASE_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    logger.info("CloudScope API berjalan.")

@app.get("/health", tags=["System"])
async def health_check():
    """Endpoint ringan untuk memastikan API berjalan."""
    return {"status": "ok", "service": "CloudScope API"}

@app.post("/upload/", status_code=status.HTTP_202_ACCEPTED, tags=["Analysis"])
async def upload_image(file: UploadFile = File(...), project_id: str = "DEFAULT"):
    """
    Unggah file citra dan masukkan tugas analisis ke antrean Celery.
    Mengembalikan task_id untuk memantau status.
    """

    # Validasi ekstensi file
    ALLOWED_EXTENSIONS = {".tif", ".tiff", ".czi", ".lif", ".nd2", ".png", ".jpg"}
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Format file tidak didukung: '{ext}'. Format yang diterima: {ALLOWED_EXTENSIONS}",
        )

    # Buat direktori unik per upload
    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(TEMP_BASE_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = os.path.basename(file.filename)  # Cegah path traversal
    file_location = os.path.join(upload_dir, safe_filename)

    # Tulis file ke disk sambil cek ukuran
    total_size = 0
    try:
        with open(file_location, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # Baca per 1 MB
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE_BYTES:
                    f.close()
                    shutil.rmtree(upload_dir, ignore_errors=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Ukuran file melebihi batas 500 MB.",
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(upload_dir, ignore_errors=True)
        logger.error(f"Gagal menyimpan file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyimpan file di server.",
        )

    # Kirim tugas ke antrean
    task = process_microscopy_image.delay(file_location, project_id=project_id)
    logger.info(f"Task [{task.id}] dikirim untuk file '{safe_filename}', project '{project_id}'.")

    return {
        "message": "File berhasil diunggah. Analisis berjalan di latar belakang.",
        "task_id": task.id,
        "filename": safe_filename,
        "project_id": project_id,
    }

@app.get("/status/{task_id}", tags=["Analysis"])
async def get_task_status(task_id: str):
    """
    Periksa status tugas berdasarkan task_id.
    Status: PENDING | STARTED | SUCCESS | FAILURE | RETRY | REVOKED
    """
    task_result = AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": task_result.status,
        "result": None,
        "error": None,
    }

    if task_result.successful():
        response["result"] = task_result.result
    elif task_result.failed():
        response["error"] = str(task_result.result)
    elif task_result.status == "STARTED":
        # Ambil metadata progres jika ada
        response["result"] = task_result.info

    return response