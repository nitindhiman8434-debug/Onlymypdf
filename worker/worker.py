"""OnlyMyPDF heavy-processing worker.

Pulls jobs from Redis (pushed by Laravel), runs smart detection + the chosen provider,
writes output to the job's isolated temp dir, and posts status/quality back to the API.
Input/output are deleted by Laravel's 1-hour TTL sweep (and Delete Now).

Run: python worker.py   (or via the python-worker docker service)
"""
from __future__ import annotations

import json
import os
import time

import redis

from detection import detect
from providers import registry
from providers.base import Job

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QUEUE_KEY = os.getenv("WORKER_QUEUE_KEY", "onlymypdf:jobs")
TEMP_DIR = os.getenv("WORKER_TEMP_DIR", "/data/temp")

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def process(payload: dict) -> None:
    job = Job(
        uuid=payload["uuid"],
        tool_code=payload["tool_code"],
        mode=payload.get("mode"),
        input_path=payload["input_path"],
        output_dir=os.path.join(TEMP_DIR, payload["uuid"]),
        options=payload.get("options", {}),
    )
    os.makedirs(job.output_dir, exist_ok=True)

    print(f"[worker] {job.uuid} {job.tool_code} mode={job.mode}")
    detection = detect(job.input_path)
    result = registry.run(job, detection)

    # TODO Phase 3: POST result + detection + quality_score back to Laravel via a
    # signed internal callback (/api/internal/jobs/{uuid}/complete), which updates the
    # tool_jobs row, charges credits, and writes file_metadata for logged-in users.
    print(f"[worker] {job.uuid} done success={result.success} quality={result.quality_score} "
          f"provider={result.provider}")


def main() -> None:
    print(f"[worker] listening on {REDIS_HOST}:{REDIS_PORT} queue={QUEUE_KEY}")
    while True:
        item = r.blpop(QUEUE_KEY, timeout=5)
        if not item:
            time.sleep(0.1)
            continue
        _, raw = item
        try:
            process(json.loads(raw))
        except Exception as exc:  # graceful failure — never crash the loop
            print(f"[worker] ERROR: {exc}")


if __name__ == "__main__":
    main()
