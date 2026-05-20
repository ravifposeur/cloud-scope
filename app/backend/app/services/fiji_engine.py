import os
import logging
import subprocess

logger = logging.getLogger(__name__)

def run_bfconvert(input_path: str, output_path: str, task_id: str):
    """Menjalankan konversi format bftools."""
    logger.info(f"[{task_id}] Menjalankan bfconvert...")
    cmd = [
        "/opt/bftools/bftools/bfconvert",
        "-overwrite",
        input_path,
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        logger.error(f"[{task_id}] bftools stderr:\n{result.stderr}")
        raise RuntimeError(f"bfconvert gagal (Code {result.returncode})")

    return output_path


def run_headless_analysis(tiff_path: str, output_csv: str, output_meta: str, task_id: str):
    """Menjalankan makro Fiji dalam mode headless."""
    logger.info(f"[{task_id}] Menjalankan komputasi Fiji...")
    macro_args = f'input="{tiff_path}",output="{output_csv}",meta="{output_meta}"'

    cmd = [
        "/opt/Fiji/fiji",
        "--headless",
        "-Djava.awt.headless=true",
        "-macro",
        "/app/scripts/analysis.ijm",
        macro_args
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=240)

    if result.returncode != 0:
        logger.error(f"[{task_id}] Fiji stderr:\n{result.stderr}")
        raise RuntimeError(f"Fiji gagal (Code {result.returncode})")

    if not os.path.exists(output_csv):
        raise FileNotFoundError(f"Output CSV tidak ditemukan oleh Fiji.")
