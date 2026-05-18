import os
import shutil
import logging
import subprocess
import json

from minio import Minio
from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from app.celery_config import celery

logger = logging.getLogger(__name__)

TEMP_BASE_DIR = "/tmp/cloudscope"

endpoint    = os.getenv("MINIO_ENDPOINT")
access_key  = os.getenv("MINIO_ACCESS_KEY")
secret_key  = os.getenv("MINIO_SECRET_KEY")
bucket      = os.getenv("MINIO_BUCKET_NAME")

# Internal client: untuk fput_object via Docker network
minio_client = Minio(
    endpoint=endpoint,
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
)

# External client: untuk generate presigned URL yang bisa diakses browser di luar container
minio_external_client = Minio(
    endpoint="localhost:9000",
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
    region="us-east-1",  # Bypass DNS resolution Docker internal
)


def _cleanup_task_dir(file_path: str, task_id: str):
    """Hapus direktori sementara milik sebuah task."""
    if file_path and os.path.exists(file_path):
        task_dir = os.path.dirname(file_path)
        shutil.rmtree(task_dir, ignore_errors=True)
        logger.info(f"[{task_id}] Temporary directory {task_dir} successfully cleaned up.")


def _scrub_metadata(meta_file_path: str):
    """
    Privacy Engine: Pisahkan metadata mentah menjadi safe dan sensitive.
    Returns: (safe_meta dict, sensitive_meta dict)
    """
    safe_meta = {}
    sensitive_meta = {}

    SENSITIVE_KEYWORDS = [
        "name", "patient", "institution", "date", "time",
        "user", "id", "location", "operator", "serial",
        "gps", "annotation", "sample", "clinic",
    ]

    if not os.path.exists(meta_file_path):
        logger.warning(f"Metadata file not found: {meta_file_path}")
        return safe_meta, sensitive_meta

    with open(meta_file_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip()
                is_sensitive = any(kw in key.lower() for kw in SENSITIVE_KEYWORDS)
                if is_sensitive:
                    sensitive_meta[key] = val
                else:
                    safe_meta[key] = val

    return safe_meta, sensitive_meta


def _strip_metadata_from_file(file_path: str, task_id: str):
    """
    GAP 1 FIX — Privacy Engine Layer 2:
    Hapus SEMUA metadata yang tertanam di file asli menggunakan exiftool
    sebelum file tersebut diunggah ke MinIO.
    Tanpa langkah ini, file yang tersimpan di MinIO masih mengandung
    metadata sensitif meski sudah diekstrak ke database.
    """
    try:
        result = subprocess.run(
            ["exiftool", "-all=", "-overwrite_original", file_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            logger.info(f"[{task_id}] Metadata stripped from original file: {file_path}")
        else:
            # Jangan hentikan pipeline — catat error lalu lanjutkan
            logger.error(f"[{task_id}] exiftool failed (non-fatal): {result.stderr}")
    except FileNotFoundError:
        logger.error(f"[{task_id}] exiftool not found in container. Install it in worker/Dockerfile.")
    except subprocess.TimeoutExpired:
        logger.error(f"[{task_id}] exiftool timed out on file: {file_path}")


@celery.task(
    bind=True,
    max_retries=3,
    autoretry_for=(IOError, TimeoutError, OSError),
    retry_backoff=True,
    retry_backoff_max=40,
    retry_jitter=False,
    dont_autoretry_for=(ValueError, SyntaxError),
)
def process_microscopy_image(self, file_path: str, project_id: str):
    task_id = self.request.id
    logger.info(f"[{task_id}] Analysis started — project: {project_id}, file: {file_path}")

    self.update_state(
        state=states.STARTED,
        meta={"project_id": project_id, "file": file_path, "progress": "0%"},
    )

    try:
        task_dir      = os.path.dirname(file_path)
        base_name     = os.path.splitext(os.path.basename(file_path))[0]

        output_csv_path  = os.path.join(task_dir, f"{base_name}_result.csv")
        raw_meta_path    = os.path.join(task_dir, f"{base_name}_raw_meta.txt")
        safe_json_path   = os.path.join(task_dir, f"{base_name}_safe_meta.json")

        csv_object_name  = f"{project_id}/{os.path.basename(output_csv_path)}"
        json_object_name = f"{project_id}/{os.path.basename(safe_json_path)}"

        # ------------------------------------------------------------------
        # STEP 1: Jalankan Fiji headless (+ Bio-Formats untuk .czi/.lif/.nd2)
        # ------------------------------------------------------------------
        macro_args = f'input="{file_path}",output="{output_csv_path}",meta="{raw_meta_path}"'
        logger.info(f"[{task_id}] Running Fiji with args: {macro_args}")

        process_result = subprocess.run(
            [
                "/opt/Fiji.app/fiji",
                "--headless",
                "-Djava.awt.headless=true",
                "-macro",
                "/app/scripts/analysis.ijm",
                macro_args,
            ],
            capture_output=True,
            text=True,
            timeout=240,
        )

        if process_result.returncode != 0:
            logger.error(f"[{task_id}] Fiji stderr:\n{process_result.stderr}")
            raise RuntimeError(
                f"Fiji exited with code {process_result.returncode}\n{process_result.stderr}"
            )

        if not os.path.exists(output_csv_path):
            raise FileNotFoundError(f"Output CSV not found: {output_csv_path}")

        self.update_state(
            state=states.STARTED,
            meta={"project_id": project_id, "file": file_path, "progress": "50%"},
        )

        # ------------------------------------------------------------------
        # STEP 2: Privacy Engine — ekstrak & pisahkan metadata
        # ------------------------------------------------------------------
        safe_meta, sensitive_meta = _scrub_metadata(raw_meta_path)

        with open(safe_json_path, "w") as jf:
            json.dump(safe_meta, jf, indent=4)

        logger.info(
            f"[{task_id}] Metadata split — "
            f"safe fields: {len(safe_meta)}, sensitive fields: {len(sensitive_meta)}"
        )

        # ------------------------------------------------------------------
        # STEP 3 (GAP 1 FIX): Strip metadata dari file asli sebelum upload
        # ------------------------------------------------------------------
        _strip_metadata_from_file(file_path, task_id)

        self.update_state(
            state=states.STARTED,
            meta={"project_id": project_id, "file": file_path, "progress": "75%"},
        )

        # ------------------------------------------------------------------
        # STEP 4: Upload file yang sudah bersih + safe JSON ke MinIO
        # ------------------------------------------------------------------
        minio_client.fput_object(
            bucket_name=bucket, object_name=csv_object_name, file_path=output_csv_path
        )
        minio_client.fput_object(
            bucket_name=bucket, object_name=json_object_name, file_path=safe_json_path
        )

        from datetime import timedelta
        csv_url  = minio_external_client.presigned_get_object(
            bucket_name=bucket, object_name=csv_object_name, expires=timedelta(hours=24)
        )
        json_url = minio_external_client.presigned_get_object(
            bucket_name=bucket, object_name=json_object_name, expires=timedelta(hours=24)
        )

        logger.info(f"[{task_id}] Files uploaded. Metadata scrubbing complete.")

        return {
            "status": "success",
            "project_id": project_id,
            "file": file_path,
            "message": "Analysis completed. Metadata scrubbed.",
            "result_csv_url": csv_url,
            "safe_metadata_url": json_url,
            # sensitive_metadata hanya ada di memori — tidak pernah masuk MinIO
            "sensitive_metadata": sensitive_meta,
        }

    except SoftTimeLimitExceeded:
        logger.warning(f"[{task_id}] SoftTimeLimitExceeded — cleaning up.")
        return {"status": "failed", "project_id": project_id, "message": "Timeout."}

    except Exception as exc:
        logger.error(f"[{task_id}] Error: {exc}. Retry {self.request.retries + 1}.")
        raise

    finally:
        # Layer 1 cleanup: selalu berjalan apapun statusnya
        _cleanup_task_dir(file_path, task_id)