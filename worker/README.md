# OnlyMyPDF — Python Worker

Heavy PDF processing: conversion, OCR, compression, translate, AI prep. Stateless —
reads jobs from Redis, writes to the job's isolated temp dir, posts results back to Laravel.

## Run
```bash
pip install -r requirements.txt
REDIS_HOST=localhost python worker.py
# or: docker compose up python-worker
```

## Layout
```
worker.py              main loop (Redis blpop → detect → run provider → callback)
detection.py           Layer 2 smart detection (digital/scanned, tables, complexity…)
providers/
  base.py              Job / Detection / Result dataclasses + ConversionProvider protocol
  local.py             Layer 1 Fast Mode + OCR (LibreOffice/Poppler/OCRmyPDF/pdfplumber/camelot)
  api_fallback.py      Layer 3/4 commercial API fallback (configured via env, off by default)
  registry.py          routing: Fast → High Accuracy → Rescue (the 5-layer brain)
```

## Design rules
- **Provider abstraction**: every engine implements `supports()` + `convert()`. No
  provider-specific logic leaks into routing or the API. See `../docs/CONVERSION_ENGINE.md`.
- **No false accuracy claims**: `Result.quality_score` is an *estimate*, surfaced as
  "Quality estimate", never "guaranteed accuracy".
- **Privacy**: the worker only touches the per-job temp dir; Laravel's TTL sweep deletes
  input/output (and intermediate OCR/AI text) within 1 hour.
- **Scaling**: stateless — run more worker containers / move to a separate VPS reading the
  same Redis when load grows. Tune `WORKER_CONCURRENCY` to vCPU.

## Current status
Pipeline is runnable with stubbed engines (clear TODOs). Wire real engines in Phase 4/5
and the Laravel completion callback in Phase 3 (see `../docs/ROADMAP.md`).
