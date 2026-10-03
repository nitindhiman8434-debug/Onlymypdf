"""Readable editable fallback for OCR transcripts containing only Latin letters.

This script check is deliberately not language identification. Text and spacing
come from actual OCR; no expected words, inferred corrections or images are added.
"""

from __future__ import annotations

import unicodedata
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


class EmptyOcrPageError(ValueError):
    def __init__(self, page_number: int):
        self.page_number = page_number
        super().__init__(f"OCR did not recognize readable text on page {page_number}")


class OcrRuntimeUnavailableError(RuntimeError):
    """The executable or its requested trained data cannot be used."""


def recognize_ocr_transcripts(source_pdf: str, *, language: str, dpi: int) -> list[str]:
    """Read Tesseract's own word boundaries rather than reconstructing PDF glyphs.

    Called only for the Latin-script fallback selected by the converter. One
    bounded PSM 3 pass per original page keeps actual lines, spaces and repeated
    content. It does not merge segmentation modes or repair recognized words.
    """
    import pymupdf as fitz

    executable = shutil.which(os.environ.get("TESSERACT_PATH", "tesseract"))
    if executable is None:
        raise OcrRuntimeUnavailableError("Tesseract executable unavailable")

    transcripts: list[str] = []
    with fitz.open(source_pdf) as source, tempfile.TemporaryDirectory(prefix="pdf2docx-ocr-text-") as temp:
        image_path = Path(temp) / "page.png"
        output_base = Path(temp) / "recognized"
        output_text = output_base.with_suffix(".txt")
        for page in source:
            page.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False).save(image_path)
            # A successful prior page must never stand in for a missing result.
            output_text.unlink(missing_ok=True)
            try:
                result = subprocess.run(
                    [executable, str(image_path), str(output_base), "-l", language,
                     "--dpi", str(dpi), "--psm", "3", "txt"],
                    capture_output=True, text=True, timeout=90, check=False,
                )
            except FileNotFoundError as exc:
                raise OcrRuntimeUnavailableError("Tesseract executable unavailable") from exc
            if result.returncode != 0:
                diagnostics = (result.stderr or "").lower()
                if any(marker in diagnostics for marker in (
                    "error opening data file", "failed loading language", "couldn't load any languages",
                )):
                    raise OcrRuntimeUnavailableError("Tesseract requested language data unavailable")
                raise RuntimeError(f"Tesseract text recognition failed (exit {result.returncode})")
            if not output_text.is_file():
                raise RuntimeError("Tesseract text recognition produced no transcript")
            # Keep actual blank lines, repeated rows and intra-line spacing.
            transcripts.append(output_text.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n"))
    return transcripts


def supports_latin_ocr(transcripts: list[str]) -> bool:
    """Select Latin-script text only; empty pages are validated separately."""
    letters = [character for text in transcripts for character in text if character.isalpha()]
    return bool(letters) and all("LATIN" in unicodedata.name(character, "") for character in letters)


def validate_page_transcripts(transcripts: list[str], page_count: int) -> None:
    if len(transcripts) != page_count:
        raise ValueError("OCR transcript count does not match the source page count")
    for page_number, text in enumerate(transcripts, 1):
        if not text.strip():
            raise EmptyOcrPageError(page_number)


def write_english_ocr_docx(source_pdf: str, output_path: str, transcripts: list[str]) -> None:
    """Write full-width OCR lines and preserve each source page's section size.

    Dimensions must come from the original input PDF, not a generated OCR PDF
    whose image resolution may change its physical page size.
    Sections start on a new page. Dense text can reflow onto more than one Word
    page; this does not promise a fixed rendered page count or original typography.
    """
    import pymupdf as fitz
    from docx import Document
    from docx.enum.section import WD_ORIENT, WD_SECTION_START
    from docx.shared import Pt

    with fitz.open(source_pdf) as source:
        validate_page_transcripts(transcripts, len(source))
        if not supports_latin_ocr(transcripts):
            raise ValueError("The readable English OCR fallback requires Latin-script text")

        word = Document()
        normal = word.styles["Normal"]
        normal.font.name = "Arial"
        normal.font.size = Pt(11)
        normal.paragraph_format.space_before = Pt(0)
        normal.paragraph_format.space_after = Pt(4)
        normal.paragraph_format.line_spacing = 1.15

        for page_index, page in enumerate(source):
            section = word.sections[0] if page_index == 0 else word.add_section(WD_SECTION_START.NEW_PAGE)
            width, height = page.rect.width, page.rect.height
            section.orientation = WD_ORIENT.LANDSCAPE if width > height else WD_ORIENT.PORTRAIT
            section.page_width, section.page_height = Pt(width), Pt(height)
            section.left_margin = section.right_margin = Pt(min(43.2, width / 10))
            section.top_margin = section.bottom_margin = Pt(min(43.2, height / 10))

            # Keep repeated lines and actual spaces. Each OCR line is editable
            # separately; no paragraph semantics or table structure are invented.
            for line in transcripts[page_index].splitlines():
                paragraph = word.add_paragraph(line)
                paragraph.paragraph_format.keep_with_next = False
                paragraph.paragraph_format.widow_control = True

        word.save(output_path)
