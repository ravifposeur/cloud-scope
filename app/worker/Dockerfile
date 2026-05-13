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

ENV PATH="/opt/Fiji:${PATH}"

WORKDIR /app

COPY backend/requirements.txt /app/

RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/ /app/

COPY scripts/ /app/scripts/

RUN mkdir -p /tmp/cloudscope
