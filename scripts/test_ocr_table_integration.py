"""Word-cell and same-pass OCR contracts independent of a real recognizer."""

from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import pymupdf as fitz
from docx import Document

from ocr_english_docx import recognize_ocr_transcripts, write_english_ocr_docx


class TableIntegrationTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.source = Path(directory.name) / "source.pdf"
        self.output = Path(directory.name) / "result.docx"
        with fitz.open() as document:
            document.new_page(width=612, height=792)
            document.new_page(width=792, height=612)
            document.save(self.source)
        self.layout = {"before": ["Invoice 001234"],
                       "rows": [["Description", "Amount"], ["Repeated service", "120.25"],
                                ["Repeated service", "120.25"]],
                       "after": ["Total 240.50"], "columnWidths": [0.75, 0.25]}
        self.raw = "Invoice 001234 Description Amount Repeated service 120.25 Repeated service 120.25 Total 240.50"

    def test_native_cells_preserve_literals_repeats_body_order_and_page_geometry(self):
        write_english_ocr_docx(str(self.source), str(self.output), [self.raw, "Last page reference"],
                              page_layouts=[self.layout, None])
        document = Document(self.output)
        self.assertEqual(len(document.tables), 1)
        table = document.tables[0]
        self.assertEqual([[c.text for c in row.cells] for row in table.rows], self.layout["rows"])
        self.assertEqual(len(document.inline_shapes), 0)
        self.assertEqual([p.text for p in document.paragraphs if p.text],
                         ["Invoice 001234", "Total 240.50", "Last page reference"])
        body = document.element.body
        blocks = [(el.tag.rsplit("}", 1)[-1], " ".join(el.xpath(".//w:t/text()"))) for el in body]
        nonempty = [(tag, text) for tag, text in blocks if text]
        self.assertEqual([tag for tag, _ in nonempty], ["p", "tbl", "p", "p"])
        self.assertEqual([(s.page_width.pt, s.page_height.pt) for s in document.sections],
                         [(612, 792), (792, 612)])
        self.assertAlmostEqual(table.columns[0].width.pt / table.columns[1].width.pt, 3, places=2)
        self.assertAlmostEqual(sum(c.width.pt for c in table.columns), 612 - 86.4, places=1)

    def test_table_count_mismatch_cannot_silently_drop_later_layout(self):
        with self.assertRaisesRegex(ValueError, "layout count"):
            write_english_ocr_docx(str(self.source), str(self.output), [self.raw, "Last page"],
                                  page_layouts=[self.layout])
        self.assertFalse(self.output.exists())

    def test_txt_and_tsv_share_one_process_and_stale_second_tsv_is_not_reused(self):
        calls = []
        def run(args, **_kwargs):
            Path(args[2] + ".txt").write_text(self.raw, encoding="utf-8")
            if not calls:
                Path(args[2] + ".tsv").write_text("first page geometry", encoding="utf-8")
            calls.append(args)
            return SimpleNamespace(returncode=0, stderr="")
        layouts = ["stale caller data"]
        with patch("ocr_english_docx.shutil.which", return_value="tesseract"), \
             patch("ocr_english_docx.subprocess.run", side_effect=run), \
             patch("ocr_ruled_tables.build_ruled_table_layout", return_value=self.layout) as geometry:
            transcripts = recognize_ocr_transcripts(str(self.source), language="eng", dpi=220,
                                                    page_layouts=layouts)
        self.assertEqual(transcripts, [self.raw, self.raw])
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(args[-2:] == ["txt", "tsv"] for args in calls))
        geometry.assert_called_once()
        self.assertEqual(layouts, [self.layout, None])

    def test_corrupt_optional_tsv_keeps_actual_text(self):
        def run(args, **_kwargs):
            Path(args[2] + ".txt").write_text(self.raw, encoding="utf-8")
            Path(args[2] + ".tsv").write_bytes(b"\xff\xfeinvalid")
            return SimpleNamespace(returncode=0, stderr="")
        layouts = []
        with patch("ocr_english_docx.shutil.which", return_value="tesseract"), \
             patch("ocr_english_docx.subprocess.run", side_effect=run):
            transcripts = recognize_ocr_transcripts(str(self.source), language="eng", dpi=220,
                                                    page_layouts=layouts)
        self.assertEqual(transcripts, [self.raw, self.raw])
        self.assertEqual(layouts, [None, None])


if __name__ == "__main__":
    unittest.main()
