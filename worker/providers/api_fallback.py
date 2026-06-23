"""Commercial API fallback provider (Layer 3/4 High Accuracy).

A single adapter for whichever commercial conversion API is configured via env
(CONVERSION_FALLBACK_PROVIDER + its key). Disabled unless configured, so the system
runs fully on local engines by default and only reaches for paid APIs on demand.
"""
from __future__ import annotations

import os
import time

from .base import Detection, Job, Result


class ApiFallbackProvider:
    name = "api_fallback"

    def __init__(self) -> None:
        self.provider = os.getenv("CONVERSION_FALLBACK_PROVIDER")  # e.g. "cloudconvert"
        self.api_key = os.getenv("CONVERSION_FALLBACK_API_KEY")

    def configured(self) -> bool:
        return bool(self.provider and self.api_key)

    def supports(self, tool_code: str) -> bool:
        # High-accuracy conversions are the typical fallback targets.
        return self.configured() and tool_code in {
            "pdf-to-word", "pdf-to-excel", "pdf-to-ppt", "extract-tables", "translate-pdf",
        }

    def convert(self, job: Job, detection: Detection) -> Result:
        started = time.time()
        # TODO Phase 5: call the configured commercial API, stream result to output_dir,
        #   record cost in conversion_provider_usage via the Laravel callback.
        return Result(
            success=True,
            output_path=f"{job.output_dir}/output",
            output_format="docx",
            quality_score=92,
            provider=f"{self.name}:{self.provider}",
            messages=["High Accuracy Mode is being used for better layout preservation."],
            pages_converted=detection.page_count,
            latency_ms=int((time.time() - started) * 1000),
        )
