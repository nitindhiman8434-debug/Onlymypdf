"""OCR geometry integration contracts with an in-memory recognizer substitute.

Recognition accuracy is tested separately through the local HTTP corpus. These
tests exercise the actual OCR function, raster DPI, page transforms and passthrough.
"""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pymupdf as fitz
from PIL import Image, ImageDraw


SPEC = importlib.util.spec_from_file_location("advanced_geometry", Path(__file__).with_name("pdf-advanced-tools.py"))
assert SPEC and SPEC.loader
advanced = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(advanced)


class OcrPdfGeometryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="onlymypdf-ocr-geometry-")
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "source.pdf"
        self.output = Path(self.temp.name) / "output.pdf"
        self.dpi_seen = []

    def add_scan(self, document, width, height, rotation=0, crop=None):
        # Asymmetric visual landmarks reveal accidental rotation or cropping.
        image = Image.new("RGB", (400, 500), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((30, 35, 150, 100), fill=(210, 30, 30))
        draw.rectangle((240, 340, 370, 450), fill=(20, 60, 210))
        page = document.new_page(width=width, height=height)
        import io
        stream = io.BytesIO()
        image.save(stream, format="PNG")
        page.insert_image(page.rect, stream=stream.getvalue(), keep_proportion=False)
        if crop:
            page.set_cropbox(fitz.Rect(crop))
        page.set_rotation(rotation)
        return page

    def recognize(self, pixmap, **_options):
        self.dpi_seen.append((pixmap.xres, pixmap.yres))
        with fitz.open() as recognized:
            page = recognized.new_page(width=pixmap.width * 72 / pixmap.xres,
                                       height=pixmap.height * 72 / pixmap.yres)
            page.insert_image(page.rect, pixmap=pixmap)
            page.insert_text((40, 60), f"Recognized English page {len(self.dpi_seen)} reference 71936",
                             fontsize=12, render_mode=3)
            return recognized.tobytes()

    def convert(self):
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", lambda pixmap, **options: self.recognize(pixmap, **options)):
            return advanced.ocr_pdf(str(self.source), str(self.output), {"languages": "eng", "dpi": 220})

    def assert_same_display(self, source, output):
        self.assertAlmostEqual(source.rect.width, output.rect.width, places=3)
        self.assertAlmostEqual(source.rect.height, output.rect.height, places=3)
        self.assertEqual(source.rotation, output.rotation)
        self.assertEqual(source.mediabox, output.mediabox)
        self.assertEqual(source.cropbox, output.cropbox)
        before = source.get_pixmap(dpi=72, alpha=False)
        after = output.get_pixmap(dpi=72, alpha=False)
        self.assertEqual((before.width, before.height), (after.width, after.height))
        self.assertEqual(before.samples, after.samples, "The original scanned appearance must remain intact")
        for word in output.get_text("words"):
            box = fitz.Rect(word[:4]) * output.rotation_matrix
            self.assertTrue((output.rect + (-0.1, -0.1, 0.1, 0.1)).contains(box))

    def test_letter_size_and_real_raster_dpi(self):
        with fitz.open() as source:
            self.add_scan(source, 612, 792)
            source.save(self.source)
        details = self.convert()
        self.assertEqual(self.dpi_seen, [(220, 220)])
        self.assertEqual(details["recognizedPages"], 1)
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assert_same_display(source[0], output[0])
            self.assertIn("reference 71936", output[0].get_text())

    def test_fractional_a4_dimensions_are_not_rounded_to_pixel_size(self):
        with fitz.open() as source:
            self.add_scan(source, 595.27559, 841.88976)
            source.save(self.source)
        self.convert()
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assert_same_display(source[0], output[0])

    def test_crop_and_all_quarter_turns_keep_visual_orientation(self):
        for angle in (0, 90, 180, 270):
            with self.subTest(rotation=angle):
                with fitz.open() as source:
                    self.add_scan(source, 720.25, 960.75, angle, (30.25, 40.5, 680.25, 900.5))
                    source.save(self.source)
                self.convert()
                with fitz.open(self.source) as source, fitz.open(self.output) as output:
                    self.assert_same_display(source[0], output[0])

    def test_mixed_pages_keep_order_and_last_page(self):
        with fitz.open() as source:
            self.add_scan(source, 612, 792)
            self.add_scan(source, 841.88976, 595.27559)
            self.add_scan(source, 720, 960, 270, (30, 40, 680, 900))
            source.save(self.source)
        self.convert()
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assertEqual(len(output), 3)
            for index in range(3):
                self.assert_same_display(source[index], output[index])
                self.assertIn(f"English page {index + 1}", output[index].get_text())

    def test_existing_text_keeps_original_boxes_rotation_and_content(self):
        with fitz.open() as source:
            page = source.new_page(width=720, height=960)
            page.insert_text((80, 90), "Existing selectable English text reference 58324")
            page.set_cropbox(fitz.Rect(30, 40, 680, 900))
            page.set_rotation(90)
            source.save(self.source)
        details = self.convert()
        self.assertEqual(self.dpi_seen, [])
        self.assertEqual(details["preservedTextPages"], 1)
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assertEqual(source[0].mediabox, output[0].mediabox)
            self.assertEqual(source[0].cropbox, output[0].cropbox)
            self.assertEqual(source[0].rotation, output[0].rotation)
            self.assertEqual(source[0].get_text(), output[0].get_text())
            self.assertEqual(source[0].get_pixmap().samples, output[0].get_pixmap().samples)

    def test_unreadable_later_page_produces_no_partial_pdf(self):
        with fitz.open() as source:
            page = source.new_page()
            page.insert_text((50, 70), "A readable selectable first page reference 58324")
            self.add_scan(source, 612, 792)
            source.save(self.source)
        with fitz.open() as blank:
            blank.new_page(width=612, height=792)
            no_text = blank.tobytes()
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=no_text):
            with self.assertRaisesRegex(ValueError, "readable text on page 2"):
                advanced.ocr_pdf(str(self.source), str(self.output), {"languages": "eng"})
        self.assertFalse(self.output.exists())

    def test_multiple_recognizer_pages_cannot_be_silently_truncated(self):
        with fitz.open() as source:
            self.add_scan(source, 612, 792)
            source.save(self.source)
        with fitz.open() as unexpected:
            for text in ("First recognized page", "Unexpected second page"):
                unexpected.new_page(width=612, height=792).insert_text((40, 60), text)
            extra_pages = unexpected.tobytes()
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=extra_pages):
            with self.assertRaisesRegex(RuntimeError, "OCR.*page count"):
                advanced.ocr_pdf(str(self.source), str(self.output), {"languages": "eng"})
        self.assertFalse(self.output.exists())

    def test_sparse_existing_text_is_not_duplicated_by_an_ocr_overlay(self):
        text = "Short text 58324"  # Below the existing searchable-page threshold.
        with fitz.open() as source:
            self.add_scan(source, 612, 792)
            source[0].insert_text((40, 180), text)
            source.save(self.source)
        with fitz.open(self.source) as source, fitz.open() as recognized:
            page = recognized.new_page(width=612, height=792)
            page.insert_image(page.rect, pixmap=source[0].get_pixmap(dpi=220, alpha=False))
            page.insert_text((40, 180), text, render_mode=3)
            ocr_bytes = recognized.tobytes()
        with patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=ocr_bytes):
            advanced.ocr_pdf(str(self.source), str(self.output), {"languages": "eng"})
        with fitz.open(self.output) as output:
            self.assertEqual(output[0].get_text().strip(), text)


if __name__ == "__main__":
    unittest.main()
