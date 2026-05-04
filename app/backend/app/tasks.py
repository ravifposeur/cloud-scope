import os
import time
import shutil
import logging

from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from app.celery_config import celery

logger = logging.getLogger(__name__)

TEMP_BASE_DIR = "/tmp/cloudscope"


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
    Tugas analisis utama:
    1. Menerima path file dan project_id.
    2. Menjalankan komputasi (simulasi).
    3. Selalu membersihkan file sementara di blok finally.
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Memulai analisis — project: {project_id}, file: {file_path}")

    # Update state ke STARTED
    self.update_state(
        state=states.STARTED,
        meta={"project_id": project_id, "file": file_path, "progress": "0%"},
    )

    try:
        # ============================================================
        # BLOK KOMPUTASI
        # Ganti bagian ini dengan pemanggilan ImageJ headless nantinya:
        # subprocess.run(["ImageJ-linux64", "--headless", "--console",
        #                 "-macro", "/scripts/analysis.ijm",
        #                 f'input="{file_path}",output="/data/results.csv"'],
        #                check=True, timeout=240)
        # ============================================================
        logger.info(f"[{task_id}] Menjalankan simulasi komputasi...")
        self.update_state(
            state=states.STARTED,
            meta={"project_id": project_id, "file": file_path, "progress": "50%"},
        )
        time.sleep(10)  # Placeholder — simulasi beban berat

        result = {
            "status": "success",
            "project_id": project_id,
            "file": file_path,
            "message": "Analisis selesai.",
        }
        logger.info(f"[{task_id}] Analisis berhasil.")
        return result

    except SoftTimeLimitExceeded:
        # Timeout halus: beri kesempatan membersihkan sebelum hard kill
        logger.warning(f"[{task_id}] SoftTimeLimitExceeded — membersihkan file sementara.")
        return {
            "status": "failed",
            "project_id": project_id,
            "message": "Timeout: analisis melebihi batas waktu.",
        }

    except Exception as exc:
        logger.error(f"[{task_id}] Error: {exc}. Percobaan ke-{self.request.retries + 1}.")
        raise  # Diserahkan ke mekanisme autoretry

    finally:
        _cleanup_task_dir(file_path, task_id)