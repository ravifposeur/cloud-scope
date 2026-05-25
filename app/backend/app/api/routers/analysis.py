import os
import uuid
import shutil
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends, Form
from celery.result import AsyncResult
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db import crud
from app.db.models import User
from app.worker.tasks import process_microscopy_image
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analysis"])

TEMP_BASE_DIR = "/tmp/cloudscope"
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB
os.makedirs(TEMP_BASE_DIR, exist_ok=True)

@router.post("/upload/", status_code=status.HTTP_202_ACCEPTED)
async def upload_image(
    file: UploadFile = File(...),
    project_id: str = Form("DEFAULT"),
    current_user: User = Depends(get_current_user), # <--- Tipe data dikoreksi
):
    """Menerima unggahan dan mengirim tugas ke Celery."""
    ALLOWED_EXTENSIONS = {".tif", ".tiff", ".czi", ".lif", ".nd2", ".png", ".jpg"}
    _, ext = os.path.splitext(file.filename or "")

    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Format ditolak. Gunakan: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(TEMP_BASE_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = os.path.basename(file.filename)
    file_location = os.path.join(upload_dir, safe_filename)

    total_size = 0
    try:
        with open(file_location, "wb") as f:
            # Chunked upload 1MB per iterasi untuk menghemat RAM
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE_BYTES:
                    f.close()
                    shutil.rmtree(upload_dir, ignore_errors=True)
                    raise HTTPException(status_code=413, detail="File melebihi 500 MB.")
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(upload_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Gagal menyimpan file.")

    # Tembak ke Celery worker (non-blocking)
    task = process_microscopy_image.delay(file_location, project_id=project_id)

    return {
        "message": "Processing started",
        "task_id": task.id,
        "operator": current_user.name
    }

@router.get("/status/{task_id}")
async def get_task_status(task_id: str, db: Session = Depends(get_db)):
    """Memantau status dan menyimpan hasil ke DB jika sukses."""
    task_result = AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": task_result.status,
        "result": None,
        "error": None,
    }

    if task_result.successful():
        result_data = task_result.result

        # Sembunyikan sensitive_metadata dari response API
        response["result"] = {
            "project_id": result_data.get("project_id"),
            "result_csv_url": result_data.get("result_csv_url"),
            "safe_metadata_url": result_data.get("safe_metadata_url"),
        }

        # Simpan ke DB hanya jika belum pernah disimpan
        if not crud.get_audit_log(db, task_id):
            crud.save_analysis_result(db, task_id, result_data)

    elif task_result.failed():
        response["error"] = str(task_result.result)
    elif task_result.status == "STARTED":
        response["result"] = task_result.info

    return response
