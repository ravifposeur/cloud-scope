FROM ubuntu:22.04

USER root

RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    python3 \
    python3-pip \
    openjdk-11-jdk \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://downloads.imagej.net/fiji/latest/fiji-latest-linux64-jdk.zip \
    && unzip fiji-latest-linux64-jdk.zip -d /opt \
    && rm fiji-latest-linux64-jdk.zip

# --- INTEGRASI BFTOOLS (Bio-Formats CLI) ---
RUN apt-get update && apt-get install -y curl unzip default-jre-headless && \
    curl -L -o bftools.zip https://downloads.openmicroscopy.org/bio-formats/8.5.0/artifacts/bftools.zip && \
    unzip bftools.zip -d /opt/bftools && \
    rm bftools.zip && \
    chmod +x /opt/bftools/bftools/*

RUN rm -f /opt/Fiji/plugins/bio-formats_plugins-8.5.0.jar

ENV PATH="/opt/Fiji:${PATH}"

WORKDIR /app

COPY backend/requirements.txt /app/

RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/ /app/

COPY scripts/ /app/scripts/

RUN mkdir -p /tmp/cloudscope
