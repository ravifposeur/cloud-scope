import os
import uuid
import shutil
import logging
import json
import hashlib

from fastapi import FastAPI, UploadFile, File, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from celery.result import AsyncResult
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.tasks import process_microscopy_image
from app.database import engine, Base, get_db
from app.models import AuditLog, AuditStatus, Metadata, PixelType
from app.routers.auth_router import router as auth_router

# Create all tables on startup (safe — skips existing tables)
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CloudScope API",
    description="API Gateway untuk platform analisis citra mikroskop berbasis cloud.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS Middleware — izinkan frontend dev server mengakses API
# Di production, ganti origins dengan domain spesifik
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)

TEMP_BASE_DIR = "/tmp/cloudscope"
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB
DB_ENCRYPTION_KEY = os.getenv("DB_ENCRYPTION_KEY", "dev-secret-key-change-in-production")

os.makedirs(TEMP_BASE_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(file_path: str) -> str:
    """Compute SHA-256 checksum of a file for the audit trail."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    logger.info("CloudScope API berjalan.")


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "CloudScope API"}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@app.post("/upload/", status_code=status.HTTP_202_ACCEPTED, tags=["Analysis"])
async def upload_image(file: UploadFile = File(...), project_id: str = "DEFAULT"):
    """
    Unggah file citra dan masukkan tugas analisis ke antrean Celery.
    """
    ALLOWED_EXTENSIONS = {".tif", ".tiff", ".czi", ".lif", ".nd2", ".png", ".jpg"}
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Format file tidak didukung: '{ext}'. Format yang diterima: {ALLOWED_EXTENSIONS}",
        )

    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(TEMP_BASE_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = os.path.basename(file.filename)
    file_location = os.path.join(upload_dir, safe_filename)

    total_size = 0
    try:
        with open(file_location, "wb") as f:
            while chunk := await file.read(1024 * 1024):
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

    task = process_microscopy_image.delay(file_location, project_id=project_id)
    logger.info(f"Task [{task.id}] dikirim untuk file '{safe_filename}', project '{project_id}'.")

    return {
        "message": "File berhasil diunggah. Analisis berjalan di latar belakang.",
        "task_id": task.id,
        "filename": safe_filename,
        "project_id": project_id,
    }


# ---------------------------------------------------------------------------
# Status + DB Save
# ---------------------------------------------------------------------------

@app.get("/status/{task_id}", tags=["Analysis"])
async def get_task_status(task_id: str, db: Session = Depends(get_db)):
    """
    Periksa status tugas. Jika sukses, simpan audit log dan metadata
    terenkripsi ke PostgreSQL.
    """
    task_result = AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": task_result.status,
        "result": None,
        "error": None,
    }

    if task_result.successful():
        result_data = task_result.result

        # Return safe URLs to the frontend
        response["result"] = {
            "project_id":        result_data.get("project_id"),
            "result_csv_url":    result_data.get("result_csv_url"),
            "safe_metadata_url": result_data.get("safe_metadata_url"),
        }

        # Only save to DB once — check if audit log already exists for this task
        existing = db.query(AuditLog).filter(AuditLog.input_checksum == task_id).first()

        if not existing:
            sensitive = result_data.get("sensitive_metadata", {})

            # --- Save encrypted sensitive metadata ---
            metadata_record = Metadata(
                # Encrypt each sensitive field individually with pgcrypto
                operator_name=func.pgp_sym_encrypt(
                    sensitive.get("operator_name", "unknown"), DB_ENCRYPTION_KEY
                ),
                instrument_serial=func.pgp_sym_encrypt(
                    sensitive.get("instrument_serial", "unknown"), DB_ENCRYPTION_KEY
                ),
                clinical_notes=func.pgp_sym_encrypt(
                    sensitive.get("clinical_notes", ""), DB_ENCRYPTION_KEY
                ) if sensitive.get("clinical_notes") else None,

                # Safe dimension fields — default to 0 if not present
                size_x=int(sensitive.get("size_x", 0)),
                size_y=int(sensitive.get("size_y", 0)),
                size_z=int(sensitive.get("size_z", 1)),
                size_c=int(sensitive.get("size_c", 1)),
                pixel_type=PixelType.uint8,       # default; update when Bio-Formats returns this
                dimension_order=sensitive.get("dimension_order", "XYCZT"),
            )
            db.add(metadata_record)

            # --- Save audit log for reproducibility ---
            audit_record = AuditLog(
                macro_text=sensitive.get("macro_text", "analysis.ijm"),
                imagej_version=sensitive.get("imagej_version", "unknown"),
                bioformats_version=sensitive.get("bioformats_version", "unknown"),
                parameters=json.dumps({"project_id": result_data.get("project_id")}),
                input_checksum=task_id,           # using task_id as unique key for now
                output_checksum=sensitive.get("output_checksum", "unknown"),
                status=AuditStatus.success,
            )
            db.add(audit_record)
            db.commit()

            logger.info(f"Task {task_id} — audit log and encrypted metadata saved to DB.")

    elif task_result.failed():
        response["error"] = str(task_result.result)

    elif task_result.status == "STARTED":
        response["result"] = task_result.info

    return response