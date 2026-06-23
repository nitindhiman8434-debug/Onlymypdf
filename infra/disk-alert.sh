#!/usr/bin/env bash
# Low-cost disk + temp-file alert. Add to cron (e.g. every 15 min):
#   */15 * * * * /opt/onlymypdf/infra/disk-alert.sh
set -euo pipefail

THRESHOLD=80
ALERT_EMAIL="${ALERT_EMAIL:-support@onlymypdf.com}"
TEMP_DIR="${TEMP_DIR:-/opt/onlymypdf/backend/storage/app/temp}"

usage=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "$usage" -ge "$THRESHOLD" ]; then
  echo "[OnlyMyPDF] Disk usage ${usage}% >= ${THRESHOLD}% on $(hostname)" \
    | mail -s "OnlyMyPDF disk alert" "$ALERT_EMAIL" 2>/dev/null || \
    echo "[OnlyMyPDF] Disk usage ${usage}% — mail not configured"
fi

# Warn if temp files are lingering far past the 1-hour TTL (cleanup may be stuck).
if [ -d "$TEMP_DIR" ]; then
  stale=$(find "$TEMP_DIR" -type f -mmin +90 | wc -l)
  if [ "$stale" -gt 0 ]; then
    echo "[OnlyMyPDF] $stale temp files older than 90 min in $TEMP_DIR (cleanup may be failing)" \
      | mail -s "OnlyMyPDF temp-cleanup alert" "$ALERT_EMAIL" 2>/dev/null || true
  fi
fi
