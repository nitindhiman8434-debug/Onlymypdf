"""Local open-source providers (Layer 1 Fast Mode + OCR).

These wrap LibreOffice/Poppler/MuPDF/qpdf/Ghostscript/OCRmyPDF/Tesseract/
pdfplumber/Camelot. The actual subprocess calls are stubbed with clear TODOs so the
pipeline is runnable and reviewable now; wire each engine in Phase 4/5.
"""
from __future__ import annotations

import time

from .base import ConversionProvider, Detection, Job, Result


class LocalFastProvider:
    """Fast Mode for simple digital PDFs (low credits, low latency)."""
    name = "local_fast"

    SUPPORTED = {
        "pdf-to-word", "pdf-to-excel", "pdf-to-ppt", "pdf-to-jpg",
        "word-to-pdf", "excel-to-pdf", "ppt-to-pdf", "html-to-pdf",
        "txt-to-pdf", "rtf-to-pdf", "odt-to-pdf", "compress-pdf",
        "flatten-pdf", "extract-tables",
    }

    def supports(self, tool_code: str) -> bool:
        return tool_code in self.SUPPORTED

    def convert(self, job: Job, detection: Detection) -> Result:
        started = time.time()
        # TODO Phase 4/5: dispatch to the right engine, e.g.
        #   word-to-pdf / *-to-pdf  -> libreoffice --headless --convert-to pdf
        #   pdf-to-jpg              -> pdftoppm (poppler)
        #   compress-pdf            -> ghostscript -dPDFSETTINGS
        #   pdf-to-word             -> pdf2docx / pdfplumber
        #   pdf-to-excel/extract    -> camelot / tabula
        quality = max(40, detection.expected_quality or 70)
        return Result(
            success=True,
            output_path=f"{job.output_dir}/output",
            output_format=_format_for(job.tool_code),
            quality_score=quality,
            provider=self.name,
            messages=["Fast Mode used."],
            pages_converted=detection.page_count,
            latency_ms=int((time.time() - started) * 1000),
        )


class LocalOcrProvider:
    """OCR via OCRmyPDF / Tesseract (English priority at launch)."""
    name = "local_ocr"

    def supports(self, tool_code: str) -> bool:
        return tool_code in {"pdf-ocr", "pdf-to-word", "pdf-to-excel"}

    def convert(self, job: Job, detection: Detection) -> Result:
        started = time.time()
        # TODO Phase 5: ocrmypdf input.pdf output.pdf --language eng (+ skip if text present)
        return Result(
            success=True,
            output_path=f"{job.output_dir}/output.pdf",
            output_format="pdf",
            quality_score=75,
            provider=self.name,
            messages=["Scanned PDF detected; OCR applied."],
            ocr_confidence=0.0,  # populate from tesseract confidence
            pages_converted=detection.page_count,
            latency_ms=int((time.time() - started) * 1000),
        )


def _format_for(tool_code: str) -> str:
    return {
        "pdf-to-word": "docx", "pdf-to-excel": "xlsx", "pdf-to-ppt": "pptx",
        "pdf-to-jpg": "zip", "extract-tables": "xlsx",
    }.get(tool_code, "pdf")


# Type-check that these satisfy the protocol.
_PROVIDERS: list[ConversionProvider] = [LocalFastProvider(), LocalOcrProvider()]
