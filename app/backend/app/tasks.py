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
    region="us-east-1",
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
    autoretry_for=(IOError, TimeoutError, OSError),
    retry_backoff=True,         # Exponential backoff otomatis (10s, 20s, 40s)
    retry_backoff_max=40,
    retry_jitter=False,
    # Error permanen: langsung FAILURE, tidak di-retry
    dont_autoretry_for=(ValueError, SyntaxError),
)
def process_microscopy_image(self, file_path: str, project_id: str):
    """
    Analyzes a microscopy image and saves the result to a CSV file.
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
        output_csv_path = os.path.join(task_dir, f"{base_name}_result.csv")

        file_name_only = os.path.basename(output_csv_path)
        object_name = f"{project_id}/{file_name_only}"

        logger.info(f"[{task_id}] Running analysis with macro args: input={file_path}, output={output_csv_path}")

        macro_args = f'input="{file_path}",output="{output_csv_path}"'

        logger.info(f"[{task_id}] Running analysis with macro args: {macro_args}")

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
            # check=True,
            timeout=240,
        )
        # DEBUG DEBUG ANEHHH
        logger.info(f"[{task_id}] Fiji return code: {process_result.returncode}")
        logger.info(f"[{task_id}] Fiji stdout:\n{process_result.stdout}")

        if process_result.stderr:
            logger.error(f"[{task_id}] Fiji stderr:\n{process_result.stderr}")

        if process_result.returncode != 0:
            raise RuntimeError(
                f"Fiji exited with code {process_result.returncode}\n"
                f"{process_result.stderr}"
            )
        # END OF DEBUG DEBUG ANEHHH

        self.update_state(
            state=states.STARTED,
            meta={"project_id": project_id, "file": file_path, "progress": "80%"},
        )

        if not os.path.exists(output_csv_path):
            raise FileNotFoundError(f"Output file not found: {output_csv_path}")

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

        result = {
            "status": "success",
            "project_id": project_id,
            "file": file_path,
            "message": "Analysis completed.",
            "result_url": download_url,
        }
        logger.info(f"[{task_id}] Analysis completed.")
        return result

    except SoftTimeLimitExceeded:
        # Timeout halus: beri kesempatan membersihkan sebelum hard kill
        logger.warning(f"[{task_id}] SoftTimeLimitExceeded — membersihkan file sementara.")
        return {
            "status": "failed",
            "project_id": project_id,
            "message": "Timeout: analysis exceeded the time limit.",
        }

    except Exception as exc:
        logger.error(f"[{task_id}] Error: {exc}. Retry attempt {self.request.retries + 1}.")
        raise  # Diserahkan ke mekanisme autoretry

    finally:
        _cleanup_task_dir(file_path, task_id)
