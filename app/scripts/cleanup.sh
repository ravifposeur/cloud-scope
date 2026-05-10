#!/bin/bash

LOG_FILE="/var/log/cloudscope-cleanup.log"
TARGET_DIR="/tmp/cloudscope"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Start cleanup process" >> "$LOG_FILE"

find "$TARGET_DIR" -mindepth 1 -type f -mmin +10 -exec rm -v {} \; >> "$LOG_FILE" 2>&1
find "$TARGET_DIR" -mindepth 1 -type d -mmin +10 -empty -exec rm -rv {} \; >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup process completed." >> "$LOG_FILE"
