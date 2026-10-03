"""OCR output contract tests using real PDFs and an injected OCR engine result."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pymupdf as fitz


SPEC = importlib.util.spec_from_file_location(
    "pdf_advanced_tools", Path(__file__).with_name("pdf-advanced-tools.py")
)
assert SPEC is not None and SPEC.loader is not None
tools = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tools)


def pdf_bytes(*texts: str) -> bytes:
    with fitz.open() as document:
        for text in texts:
            page = document.new_page(width=200, height=200)
            if text:
                page.insert_text((20, 40), text, fontsize=10)
        return document.tobytes()


def input_pdf(path: Path, *texts: str) -> None:
    """An empty string creates an image-only page; other strings stay searchable."""
    with fitz.open() as source:
        for text in texts:
            page = source.new_page(width=200, height=200)
            if text:
                page.insert_text((20, 40), text, fontsize=10)
            else:
                # The fixture is raster-only; no Tesseract executable is required.
                with fitz.open(stream=pdf_bytes("Raster sample"), filetype="pdf") as sample:
                    image = sample[0].get_pixmap().tobytes("png")
                page.insert_image(page.rect, stream=image)
        source.save(path)


class OcrOutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix="onlymypdf-ocr-contract-")
        self.addCleanup(self.directory.cleanup)
        self.input = Path(self.directory.name) / "input.pdf"
        self.output = Path(self.directory.name) / "output.pdf"

    def convert(self) -> dict:
        return tools.ocr_pdf(str(self.input), str(self.output), {"languages": "eng"})

    def test_unreadable_image_only_page_does_not_produce_output(self) -> None:
        input_pdf(self.input, "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=pdf_bytes("")):
            with self.assertRaisesRegex(ValueError, "OCR engine.*page 1"):
                self.convert()
        self.assertFalse(self.output.exists())

    def test_whitespace_only_recognition_does_not_produce_output(self) -> None:
        input_pdf(self.input, "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=pdf_bytes("   ")):
            with self.assertRaisesRegex(ValueError, "OCR engine.*page 1"):
                self.convert()
        self.assertFalse(self.output.exists())

    def test_existing_searchable_page_is_preserved_without_ocr(self) -> None:
        original = "Already searchable source text"
        input_pdf(self.input, original)
        with patch.object(fitz.Pixmap, "pdfocr_tobytes") as recognize:
            result = self.convert()
        recognize.assert_not_called()
        self.assertEqual(result["recognizedPages"], 0)
        self.assertEqual(result["preservedTextPages"], 1)
        with fitz.open(self.output) as output:
            self.assertEqual(output.page_count, 1)
            self.assertIn(original, output[0].get_text())

    def test_mixed_searchable_and_successful_raster_pages_remain_usable(self) -> None:
        original = "Already searchable source text"
        recognized = "Recognized raster content"
        input_pdf(self.input, original, "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=pdf_bytes(recognized)) as recognize:
            result = self.convert()
        self.assertEqual(recognize.call_count, 1)
        self.assertEqual(result["recognizedPages"], 1)
        self.assertEqual(result["preservedTextPages"], 1)
        self.assertEqual(result["pageCount"], 2)
        with fitz.open(self.output) as output:
            self.assertEqual(output.page_count, 2)
            self.assertIn(original, output[0].get_text())
            self.assertIn(recognized, output[1].get_text())

    def test_existing_text_cannot_hide_a_later_unreadable_raster_page(self) -> None:
        input_pdf(self.input, "Already searchable source text", "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=pdf_bytes("")):
            with self.assertRaisesRegex(ValueError, "OCR engine.*page 2"):
                self.convert()
        self.assertFalse(self.output.exists())

    def test_successful_ocr_cannot_hide_a_later_unreadable_raster_page(self) -> None:
        input_pdf(self.input, "", "")
        results = [pdf_bytes("Recognized raster content"), pdf_bytes("")]
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", side_effect=results):
            with self.assertRaisesRegex(ValueError, "OCR engine.*page 2"):
                self.convert()
        self.assertFalse(self.output.exists())

    def test_legitimate_short_recognition_does_not_get_an_arbitrary_text_threshold(self) -> None:
        input_pdf(self.input, "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=pdf_bytes("7")):
            result = self.convert()
        self.assertEqual(result["recognizedPages"], 1)
        with fitz.open(self.output) as output:
            self.assertEqual(output[0].get_text().strip(), "7")

    def test_engine_failure_keeps_existing_error_contract_and_no_output(self) -> None:
        input_pdf(self.input, "")
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", side_effect=RuntimeError("missing data")):
            with self.assertRaisesRegex(RuntimeError, "OCR engine or requested language data is unavailable"):
                self.convert()
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
