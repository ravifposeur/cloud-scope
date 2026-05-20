import os
import re
import logging
import subprocess

logger = logging.getLogger(__name__)

def scrub_metadata(meta_file_path: str):
    """
    Privacy Engine Layer 1: Pisahkan metadata mentah menjadi safe dan sensitive.
    Menggunakan Regex murni untuk membongkar blok OME-XML raksasa dari Fiji.
    """
    safe_meta = {}
    sensitive_meta = {}

    if not os.path.exists(meta_file_path):
        logger.warning(f"Metadata file not found: {meta_file_path}")
        return safe_meta, sensitive_meta

    with open(meta_file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # 1. Ekstrak Data Sains/Terbuka (Safe) lewat Radar Regex
    x_match = re.search(r'SizeX="(\d+)"', content)
    y_match = re.search(r'SizeY="(\d+)"', content)
    z_match = re.search(r'SizeZ="(\d+)"', content)
    dim_match = re.search(r'DimensionOrder="([^"]+)"', content)

    if x_match: safe_meta["size_x"] = int(x_match.group(1))
    if y_match: safe_meta["size_y"] = int(y_match.group(1))
    if z_match: safe_meta["size_z"] = int(z_match.group(1))
    if dim_match: safe_meta["dimension_order"] = dim_match.group(1)

    # 2. Ekstrak Data Sensitif (Privacy Target)
    user_match = re.search(r'UserName="([^"]+)"', content)
    serial_match = re.search(r'SystemSerialNumber.*?Value>\[([^\]]+)\]', content, re.DOTALL)

    if user_match:
        sensitive_meta["operator_name"] = user_match.group(1)
    else:
        sensitive_meta["operator_name"] = "unknown"

    if serial_match:
        sensitive_meta["instrument_serial"] = serial_match.group(1)
    else:
        # Fallback cari identifier kamera simulation dari ZEN XML jika serial number absen
        cam_match = re.search(r'CameraIdentifier.*?Value>\[([^\]]+)\]', content, re.DOTALL)
        sensitive_meta["instrument_serial"] = cam_match.group(1) if cam_match else "unknown"

    return safe_meta, sensitive_meta


def strip_binary_metadata(file_path: str, task_id: str):
    """
    Privacy Engine Layer 2: Hapus SEMUA metadata tersemat menggunakan exiftool.
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
            logger.error(f"[{task_id}] exiftool failed (non-fatal): {result.stderr}")
    except FileNotFoundError:
        logger.error(f"[{task_id}] exiftool not found in container. Install it in worker/Dockerfile.")
    except subprocess.TimeoutExpired:
        logger.error(f"[{task_id}] exiftool timed out on file: {file_path}")
