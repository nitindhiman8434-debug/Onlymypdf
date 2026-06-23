"""Provider abstraction for OnlyMyPDF heavy processing.

Every conversion/OCR/AI engine — local open-source OR a commercial API — implements
the same interface so the rest of the system never hardcodes provider-specific logic.
See docs/CONVERSION_ENGINE.md for the 5-layer architecture this supports.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class Job:
    uuid: str
    tool_code: str
    mode: str | None          # "fast" | "high_accuracy" | None
    input_path: str
    output_dir: str
    options: dict = field(default_factory=dict)


@dataclass
class Detection:
    """Smart-detection result (Layer 2). Drives routing, credit estimate, quality meter."""
    digital_vs_scanned: str = "digital"   # "digital" | "scanned" | "mixed"
    page_count: int = 0
    text_density: float = 0.0
    image_density: float = 0.0
    table_pages: int = 0
    has_forms: bool = False
    multi_column: bool = False
    unusual_fonts: bool = False
    languages: list[str] = field(default_factory=lambda: ["en"])
    rotated_pages: int = 0
    encrypted: bool = False
    complexity_score: int = 0   # 0-100
    expected_quality: int = 0   # 0-100


@dataclass
class Result:
    success: bool
    output_path: str | None = None
    output_format: str | None = None
    quality_score: int = 0      # estimate, NEVER a guaranteed-accuracy claim
    provider: str = ""
    messages: list[str] = field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None
    pages_converted: int = 0
    ocr_confidence: float | None = None
    tables_found: int | None = None
    latency_ms: int | None = None


@runtime_checkable
class ConversionProvider(Protocol):
    """A provider can handle one or more tools. Implement supports() + convert()."""
    name: str

    def supports(self, tool_code: str) -> bool: ...

    def convert(self, job: Job, detection: Detection) -> Result: ...
