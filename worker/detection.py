"""Layer 2 — Smart Detection.

Cheap pre-scan that classifies a PDF before processing. Drives provider routing,
the credit estimate, and the live quality meter. Wired to pdfplumber/PyMuPDF in Phase 5;
returns a sane default now so the pipeline is runnable.
"""
from __future__ import annotations

from providers.base import Detection


def detect(input_path: str) -> Detection:
    # TODO Phase 5: open with PyMuPDF/pdfplumber and measure:
    #   - text vs image area  -> digital_vs_scanned, text/image density
    #   - table heuristics     -> table_pages
    #   - /AcroForm presence   -> has_forms
    #   - column clustering     -> multi_column
    #   - font set              -> unusual_fonts
    #   - language guess        -> languages (hi/en/…)
    #   - /Encrypt              -> encrypted
    # complexity_score & expected_quality are derived from the above.
    det = Detection(
        digital_vs_scanned="digital",
        page_count=1,
        text_density=0.6,
        complexity_score=30,
        expected_quality=80,
    )
    det.complexity_score = _complexity(det)
    det.expected_quality = max(0, 100 - det.complexity_score)
    return det


def _complexity(d: Detection) -> int:
    score = 0
    score += 30 if d.digital_vs_scanned == "scanned" else 0
    score += min(30, d.table_pages * 6)
    score += 15 if d.multi_column else 0
    score += 10 if d.unusual_fonts else 0
    score += 10 if d.has_forms else 0
    return min(100, score)
