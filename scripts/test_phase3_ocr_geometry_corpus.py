"""Offline tests for OCR artifact validators; no HTTP or OCR execution."""

import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

import fitz

SPEC = importlib.util.spec_from_file_location("ocr_geometry_corpus", Path(__file__).with_name("phase3-ocr-geometry-corpus.py"))
CORPUS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CORPUS)


class GeometryValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.directory = Path(cls.temporary.name)
        cls.fixtures = {}
        for case in CORPUS.case_definitions():
            # Selectable source PDFs let these tests validate geometry without OCR.
            cls.fixtures[case["caseId"]] = CORPUS.generate_fixture(case, cls.directory)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def inspect(self, case_id, output=None, expected=None, searchable=False):
        fixture = self.fixtures[case_id]
        source = Path(fixture["sourcePath"])
        return CORPUS.inspect_output(source, output or source, expected or fixture["pages"],
                                     self.directory / self.id().split(".")[-1], case_id, searchable)

    def test_all_valid_sources_pass_including_rotated_cropped_pages(self):
        for case_id in self.fixtures:
            with self.subTest(case=case_id):
                result = self.inspect(case_id, searchable=case_id == "searchable-passthrough")
                self.assertTrue(result["passed"], result)

    def test_scanned_inputs_have_zero_selectable_text(self):
        for case_id, fixture in self.fixtures.items():
            if case_id == "searchable-passthrough":
                self.assertGreater(fixture["selectableTextCharacters"], 0)
            else:
                self.assertEqual(fixture["selectableTextCharacters"], 0)
                self.assertTrue(fixture["imageOnly"])

    def test_rejects_old_letter_physical_size_regression(self):
        source = Path(self.fixtures["letter-portrait"]["sourcePath"])
        output = self.directory / "wrong-dimensions.pdf"
        with fitz.open(source) as original, fitz.open() as changed:
            page = changed.new_page(width=1402.5, height=1815)
            page.show_pdf_page(page.rect, original, 0)
            changed.save(output)
        result = self.inspect("letter-portrait", output)
        self.assertFalse(result["passed"])
        self.assertFalse(result["pages"][0]["dimensionsMatched"])
        self.assertFalse(result["pages"][0]["render"]["samePixelDimensions"])
        self.assertTrue(result["pages"][0]["fullTextAndOrderMatched"])

    def test_rejects_swapped_pages(self):
        source = Path(self.fixtures["rotated-crop-mixed"]["sourcePath"])
        output = self.directory / "swapped.pdf"
        with fitz.open(source) as changed:
            changed.select([1, 0, 2])
            changed.save(output)
        result = self.inspect("rotated-crop-mixed", output)
        self.assertFalse(result["passed"])
        self.assertTrue(result["pageCountMatched"])
        self.assertFalse(result["pages"][0]["fullTextAndOrderMatched"])

    def test_rejects_missing_word(self):
        case = copy.deepcopy(CORPUS.case_definitions()[0])
        case["caseId"] = "missing-word"
        case["pages"][0]["text"] = case["pages"][0]["text"].replace("green trees", "trees")
        bad = CORPUS.generate_fixture(case, self.directory)
        result = self.inspect("letter-portrait", Path(bad["sourcePath"]))
        self.assertFalse(result["passed"])
        self.assertFalse(result["pages"][0]["fullTextAndOrderMatched"])

    def test_rejects_missing_last_page(self):
        source = Path(self.fixtures["rotated-crop-mixed"]["sourcePath"])
        output = self.directory / "missing-last-page.pdf"
        with fitz.open(source) as changed:
            changed.select([0, 1])
            changed.save(output)
        result = self.inspect("rotated-crop-mixed", output)
        self.assertFalse(result["passed"])
        self.assertFalse(result["pageCountMatched"])
        self.assertFalse(result["lastPageTextMatched"])

    def test_word_boundaries_are_not_removed(self):
        self.assertNotEqual(CORPUS.normalize_text("green trees"), CORPUS.normalize_text("greentrees"))
        self.assertEqual(CORPUS.normalize_text("green\n trees"), "green trees")

    def test_rejects_non_pdf_magic(self):
        output = self.directory / "not-a-pdf.pdf"
        output.write_text("<html>Failure</html>", encoding="utf-8")
        result = self.inspect("letter-portrait", output)
        self.assertFalse(result["passed"])
        self.assertFalse(result["pdfMagic"])

    def test_multipart_sets_english_explicitly(self):
        payload, content_type = CORPUS.multipart(Path(self.fixtures["letter-portrait"]["inputPath"]))
        self.assertIn(b'name="languages"\r\n\r\neng\r\n', payload)
        self.assertIn("multipart/form-data; boundary=", content_type)


if __name__ == "__main__":
    unittest.main()
