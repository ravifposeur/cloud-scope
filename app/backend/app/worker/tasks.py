import os
import shutil
import logging
from celery import states
from celery.exceptions import SoftTimeLimitExceeded

from app.worker.celery_config import celery
from app.services import storage, privacy, fiji_engine

logger = logging.getLogger(__name__)

# =====================================================================
# KAMUS MAKRO (Bisa dipindah ke .env atau config.py nantinya)
# =====================================================================
MACRO_REGISTRY = {
    "PROJECT_CELLCOUNT": "/app/scripts/macro_cell.ijm",
    "PROJECT_EDGEDETECT": "/app/scripts/macro_edge.ijm",    # Tambahkan project_id dan makro spesifik komunitas di sini
}
DEFAULT_MACRO = "/app/scripts/analysis.ijm"


def _cleanup_task_dir(file_path: str, task_id: str):
    """Hapus direktori sementara milik sebuah task setelah selesai."""
    if file_path and os.path.exists(file_path):
        task_dir = os.path.dirname(file_path)
        shutil.rmtree(task_dir, ignore_errors=True)
        logger.info(f"[{task_id}] Temporary directory {task_dir} successfully cleaned up.")

@celery.task(
    bind=True,
    max_retries=3,
    autoretry_for=(IOError, TimeoutError, OSError, RuntimeError),
    retry_backoff=True,
    retry_backoff_max=40,
    retry_jitter=False,
    dont_autoretry_for=(ValueError, SyntaxError, FileNotFoundError),
)
def process_microscopy_image(self, file_path: str, project_id: str):
    """
    Analyzes a microscopy image and saves the result to a CSV file.
    4-Stage Pipeline Modular Orchestrator.
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Analysis started — project: {project_id}, file: {file_path}")

    # Flag untuk mengontrol penghapusan folder (Garbage Collection)
    is_success = False

    self.update_state(
        state=states.STARTED,
        meta={"project_id": project_id, "file": file_path, "progress": "0%"},
    )

    try:
        # Inisialisasi Path
        task_dir = os.path.dirname(file_path)
        base_name = os.path.splitext(os.path.basename(file_path))[0]

        converted_tiff_path = os.path.join(task_dir, f"{base_name}.ome.tiff")
        output_csv_path = os.path.join(task_dir, f"{base_name}_result.csv")
        raw_meta_path = os.path.join(task_dir, f"{base_name}_raw_meta.txt")
        safe_json_path = os.path.join(task_dir, f"{base_name}_safe_meta.json")

        # 👇 PENENTUAN MAKRO DINAMIS BERDASARKAN PROJECT_ID
        target_macro = MACRO_REGISTRY.get(project_id, DEFAULT_MACRO)
        logger.info(f"[{task_id}] Makro yang dipilih: {target_macro}")

        # ==============================================================
        # STAGE 1: KONVERSI (Memanggil fiji_engine)
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "20%", "status": "Converting format"})
        fiji_engine.run_bfconvert(file_path, converted_tiff_path, task_id)
        logger.info(f"[{task_id}] STAGE 1 Complete.")

        # ==============================================================
        # STAGE 2: FIJI HEADLESS (Memanggil fiji_engine)
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "50%", "status": "Running Fiji analysis"})
        # 👇 INJEKSI PARAMETER target_macro KE DALAM ENGINE
        fiji_engine.run_headless_analysis(converted_tiff_path, output_csv_path, raw_meta_path, task_id, macro_path=target_macro)
        logger.info(f"[{task_id}] STAGE 2 Complete.")

        # ==============================================================
        # STAGE 3: PRIVACY ENGINE (Memanggil privacy)
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "70%", "status": "Scrubbing metadata"})
        safe_meta, sensitive_meta = privacy.scrub_metadata(raw_meta_path)

        # Simpan safe_meta ke JSON untuk MinIO
        import json
        with open(safe_json_path, "w") as jf:
            json.dump(safe_meta, jf, indent=4)

        privacy.strip_binary_metadata(file_path, task_id)
        logger.info(f"[{task_id}] STAGE 3 Complete.")

        # ==============================================================
        # STAGE 4: MINIO UPLOAD (Memanggil storage)
        # ==============================================================
        self.update_state(state=states.STARTED, meta={"progress": "85%", "status": "Uploading results"})
        urls = storage.upload_analysis_results(project_id, output_csv_path, safe_json_path, file_path)
        logger.info(f"[{task_id}] STAGE 4 Complete.")

        # Menandakan pipeline sukses mencapai akhir tanpa error
        is_success = True
        all_meta_for_api = {**safe_meta, **sensitive_meta}

        return {
            "status": "success",
            "project_id": project_id,
            "file": file_path,
            "message": "Analysis completed. Metadata scrubbed.",
            "result_csv_url": urls["csv_url"],
            "safe_metadata_url": urls["json_url"],
            "sensitive_metadata": all_meta_for_api,
            "used_macro": target_macro # 👇 TAMBAHAN AGAR BISA DIBACA OLEH crud.py
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
        # GARBAGE COLLECTION
        if self.request.retries >= self.max_retries or is_success:
            _cleanup_task_dir(file_path, task_id)
        else:
            logger.warning(f"[{task_id}] Skip cleanup because task will be retried.")
