"""Provider registry + routing (the brain of the 5-layer engine).

Picks a provider for a job based on tool, mode, and smart-detection. Encapsulates
Fast Mode → High Accuracy → Rescue routing so no caller needs provider-specific logic.
"""
from __future__ import annotations

from .api_fallback import ApiFallbackProvider
from .base import Detection, Job, Result
from .local import LocalFastProvider, LocalOcrProvider

_FAST = LocalFastProvider()
_OCR = LocalOcrProvider()
_API = ApiFallbackProvider()


def choose(job: Job, detection: Detection):
    """Return the best provider for this job (Layers 1–4)."""
    # Scanned input → OCR first.
    if detection.digital_vs_scanned == "scanned" and _OCR.supports(job.tool_code):
        return _OCR

    # Explicit High Accuracy or high complexity → prefer commercial API if configured.
    high_accuracy = job.mode == "high_accuracy" or detection.complexity_score >= 70
    if high_accuracy and _API.supports(job.tool_code):
        return _API

    # Default: local Fast Mode.
    if _FAST.supports(job.tool_code):
        return _FAST

    # Last resort.
    return _API if _API.supports(job.tool_code) else _FAST


def run(job: Job, detection: Detection) -> Result:
    """Run the chosen provider, with Rescue Mode if Fast output looks weak."""
    provider = choose(job, detection)
    result = provider.convert(job, detection)

    # Rescue Mode (Layer 4): weak Fast result + API available → retry high accuracy.
    weak = result.quality_score < 55
    if weak and provider is _FAST and _API.supports(job.tool_code):
        result = _API.convert(job, detection)
        result.messages.append("Rescue Mode: retried with High Accuracy.")

    return result
