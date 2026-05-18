FROM ubuntu:22.04

USER root

RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    python3 \
    python3-pip \
    openjdk-11-jdk \
    # GAP 1 FIX: exiftool diperlukan oleh _strip_metadata_from_file() di tasks.py
    # Tanpa ini, metadata sensitif tidak akan terhapus dari file sebelum masuk MinIO
    libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

# 1. Download dan ekstrak Fiji
RUN wget https://downloads.imagej.net/fiji/latest/fiji-latest-linux64-jdk.zip \
    && unzip fiji-latest-linux64-jdk.zip -d /opt \
    && rm fiji-latest-linux64-jdk.zip

# 2. Download plugin Bio-Formats ke folder plugins Fiji
RUN wget -O /opt/Fiji.app/plugins/bioformats_package.jar \
    https://downloads.openmicroscopy.org/bio-formats/7.3.0/artifacts/bioformats_package.jar

# 3. Set PATH
ENV PATH="/opt/Fiji.app:${PATH}"

WORKDIR /app

COPY backend/requirements.txt /app/
RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY scripts/ /app/scripts/

RUN mkdir -p /tmp/cloudscope