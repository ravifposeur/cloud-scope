import os
import time
import shutil
import logging
import subprocess

from minio import Minio
from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from app.celery_config import celery

logger = logging.getLogger(__name__)

TEMP_BASE_DIR = "/tmp/cloudscope"

endpoint = os.getenv("MINIO_ENDPOINT")
access_key = os.getenv("MINIO_ACCESS_KEY")
secret_key = os.getenv("MINIO_SECRET_KEY")
bucket = os.getenv("MINIO_BUCKET_NAME")

minio_client = Minio(
    endpoint=endpoint,
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
)

minio_external_client = Minio(
    endpoint="localhost:9000",
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
    region="us-east-1",  # Menggunakan region valid untuk AWS Signature
)


def _cleanup_task_dir(file_path: str, task_id: str):
    if file_path and os.path.exists(file_path):
        task_dir = os.path.dirname(file_path)

        shutil.rmtree(task_dir, ignore_errors=True)
        logger.info(f"[{task_id}] Temporary directory {task_dir} successfully cleaned up.")


@celery.task(
    bind=True,
    max_retries=3,
    # Error sementara yang layak di-retry
    autoretry_for=(IOError, TimeoutError, OSError, RuntimeError),
    retry_backoff=True,         # Exponential backoff otomatis (10s, 20s, 40s)
    retry_backoff_max=40,
    retry_jitter=False,
    # Error permanen: langsung FAILURE, tidak di-retry
    dont_autoretry_for=(ValueError, SyntaxError, FileNotFoundError),
)
def process_microscopy_image(self, file_path: str, project_id: str):
    """
    Analyzes a microscopy image and saves the result to a CSV file.
    Uses a 2-stage pipeline: bfconvert (CLI) -> Fiji (Headless).
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Analysis started — project: {project_id}, file: {file_path}")

    # Update state ke STARTED
    self.update_state(
        state=states.STARTED,
        meta={"project_id": project_id, "file": file_path, "progress": "0%"},
    )

    try:
        task_dir = os.path.dirname(file_path)
        base_name = os.path.splitext(os.path.basename(file_path))[0]

        # Definisikan path untuk file konversi dan hasil
        converted_tiff_path = os.path.join(task_dir, f"{base_name}.ome.tiff")
        output_csv_path = os.path.join(task_dir, f"{base_name}_result.csv")

        # ==============================================================
        # STAGE 1: KONVERSI VENDOR (.CZI) KE OPEN FORMAT (.OME.TIFF)
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "20%", "status": "Converting format"})
        logger.info(f"[{task_id}] STAGE 1: Running bfconvert for {file_path}...")

        bf_cmd = [
            "/opt/bftools/bftools/bfconvert",
            "-overwrite",
            file_path,
            converted_tiff_path
        ]

        bf_result = subprocess.run(bf_cmd, capture_output=True, text=True, timeout=300)

        if bf_result.returncode != 0:
            # Tampilkan kedua jalur log agar kita tidak pernah buta lagi
            logger.error(f"[{task_id}] bftools stdout:\n{bf_result.stdout}")
            logger.error(f"[{task_id}] bftools stderr:\n{bf_result.stderr}")
            raise RuntimeError(f"bfconvert failed with exit code {bf_result.returncode}\n{bf_result.stdout}\n{bf_result.stderr}")

        logger.info(f"[{task_id}] STAGE 1 Complete. File converted to OME-TIFF.")

        # ==============================================================
        # STAGE 2: ANALISIS FIJI PADA FILE TIFF
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "50%", "status": "Running Fiji analysis"})

        # Kirim argument polos dipisah koma agar tidak merusak macro parser
        macro_args = f"{converted_tiff_path},{output_csv_path}"
        logger.info(f"[{task_id}] STAGE 2: Running analysis with macro args: {macro_args}")

        process_result = subprocess.run(
            [
                "/opt/Fiji/fiji",
                "--headless",
                "-Djava.awt.headless=true",
                "-macro",
                "/app/scripts/analysis.ijm",
                macro_args
            ],
            capture_output=True,
            text=True,
            timeout=240,
        )

        logger.info(f"[{task_id}] Fiji return code: {process_result.returncode}")
        logger.info(f"[{task_id}] Fiji stdout:\n{process_result.stdout}")

        if process_result.stderr:
            logger.error(f"[{task_id}] Fiji stderr:\n{process_result.stderr}")

        if process_result.returncode != 0:
            raise RuntimeError(
                f"Fiji exited with code {process_result.returncode}\n"
                f"{process_result.stderr}"
            )

        # ==============================================================
        # STAGE 3: UPLOAD HASIL KE MINIO
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "80%", "status": "Uploading results"})

        if not os.path.exists(output_csv_path):
            raise FileNotFoundError(f"Output file not found: {output_csv_path}")

        file_name_only = os.path.basename(output_csv_path)
        object_name = f"{project_id}/{file_name_only}"

        minio_client.fput_object(
            bucket_name=bucket,
            object_name=object_name,
            file_path=output_csv_path,
        )

        from datetime import datetime, timedelta
        download_url = minio_external_client.presigned_get_object(
            bucket_name=bucket,
            object_name=object_name,
            expires=timedelta(hours=24),
        )
        logger.info(f"[{task_id}] Analysis complete, result uploaded to {object_name}")

        return {
            "status": "success",
            "project_id": project_id,
            "file": file_path,
            "message": "Analysis completed.",
            "result_url": download_url,
        }

    except SoftTimeLimitExceeded:
        logger.warning(f"[{task_id}] SoftTimeLimitExceeded — membersihkan file sementara.")
        return {
            "status": "failed",
            "project_id": project_id,
            "message": "Timeout: analysis exceeded the time limit.",
        }

    except Exception as exc:
        logger.error(f"[{task_id}] Error: {exc}. Retry attempt {self.request.retries + 1}.")
        raise

    finally:
        if self.request.retries >= self.max_retries or 'process_result' in locals() and process_result.returncode == 0:
            _cleanup_task_dir(file_path, task_id)
        else:
            logger.warning(f"[{task_id}] Skip cleanup because task will be retried.")
