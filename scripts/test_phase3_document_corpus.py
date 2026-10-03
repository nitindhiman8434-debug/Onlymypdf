"""Behavioral tests for synthetic-corpus validation; no server or font needed."""

import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

spec = importlib.util.spec_from_file_location("phase3_corpus", Path(__file__).with_name("phase3-document-corpus.py"))
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class CorpusValidationTests(unittest.TestCase):
    def office(self, extension, parts):
        if extension == ".xlsx":
            sheets = sorted(name for name in parts if name.startswith("xl/worksheets/"))
            book = ET.Element(corpus.S + "workbook")
            sheet_list = ET.SubElement(book, corpus.S + "sheets")
            relationships = ET.Element(corpus.PKG_R + "Relationships")
            for index, part in enumerate(sheets, 1):
                title = "Table 1" if index == 1 else "Source text"
                ET.SubElement(sheet_list, corpus.S + "sheet", {"name": title, "sheetId": str(index), corpus.R + "id": "rId" + str(index)})
                ET.SubElement(relationships, corpus.PKG_R + "Relationship", {"Id": "rId" + str(index), "Target": part.removeprefix("xl/")})
            parts["xl/workbook.xml"] = ET.tostring(book)
            parts["xl/_rels/workbook.xml.rels"] = ET.tostring(relationships)
        path = Path(self.tmp.name) / ("sample" + extension)
        with zipfile.ZipFile(path, "w") as archive:
            for name, text in {"[Content_Types].xml": "<Types/>", **parts}.items():
                archive.writestr(name, text)
        return path

    def spreadsheet(self, primary_rows, recovery_text=None):
        def worksheet(rows):
            sheet = ET.Element(corpus.S + "worksheet")
            data = ET.SubElement(sheet, corpus.S + "sheetData")
            for row_index, values in enumerate(rows, 1):
                row = ET.SubElement(data, corpus.S + "row", {"r": str(row_index)})
                for column, value in enumerate(values):
                    attributes = {"r": chr(65 + column) + str(row_index)}
                    if isinstance(value, str):
                        attributes["t"] = "inlineStr"
                        cell = ET.SubElement(row, corpus.S + "c", attributes)
                        ET.SubElement(ET.SubElement(cell, corpus.S + "is"), corpus.S + "t").text = value
                    else:
                        cell = ET.SubElement(row, corpus.S + "c", attributes)
                        ET.SubElement(cell, corpus.S + "v").text = str(value)
            return ET.tostring(sheet)
        parts = {"xl/worksheets/sheet1.xml": worksheet(primary_rows)}
        if recovery_text is not None:
            recovery_rows = [["Page", "Selectable text not fully mapped to table cells"],
                             ["Info", "Metadata, not source content"]] + [[1, text] for text in recovery_text]
            parts["xl/worksheets/sheet2.xml"] = worksheet(recovery_rows)
        return self.office(".xlsx", parts)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_unicode_keeps_hindi_accents_and_decimal_meaning(self):
        self.assertEqual(corpus.normalize_text("Référence\n 1\u00a0234,56"), corpus.normalize_text("Re\u0301fe\u0301rence 1234,56"))
        self.assertEqual(corpus.normalize_text("e \n\u0301"), corpus.normalize_text("é"))
        self.assertEqual(corpus.normalize_text("कुल \n राशि"), corpus.normalize_text("कुल राशि"))
        self.assertNotEqual(corpus.normalize_text("Crème"), corpus.normalize_text("Creme"))
        self.assertNotEqual(corpus.normalize_text("1.234,56"), corpus.normalize_text("1234.56"))
        self.assertNotEqual(corpus.normalize_text("001234"), corpus.normalize_text("1234"))
        self.assertTrue(corpus.normalize_text("हिन्दी"))

    def test_occurrence_counts_find_loss_and_duplication(self):
        expected = corpus.markers("LAST-993", repeats={"कुल राशि": 2})
        check = corpus.marker_check("कुल राशि LAST-993 LAST-993", expected)
        self.assertFalse(check["passed"])
        self.assertEqual(check["missing"][0]["text"], "कुल राशि")
        self.assertEqual(check["duplicated"][0]["text"], "LAST-993")

    def test_formula_cache_is_not_accepted_as_literal_text(self):
        worksheet = f'<worksheet xmlns="{corpus.S[1:-1]}"><sheetData><row><c r="A1"><f>2+3</f><v>5</v></c></row></sheetData></worksheet>'
        path = self.office(".xlsx", {"xl/workbook.xml": "<workbook/>", "xl/worksheets/sheet1.xml": worksheet})
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("5"))
        self.assertFalse(result["passed"])
        self.assertEqual(len(result["formulaCells"]), 1)
        self.assertEqual(result["primaryTextChars"], 0)

    def test_formula_like_literal_is_safe_and_preserved(self):
        worksheet = f'<worksheet xmlns="{corpus.S[1:-1]}"><sheetData><row><c r="A1" t="inlineStr"><is><t>=2+3</t></is></c></row></sheetData></worksheet>'
        path = self.office(".xlsx", {"xl/workbook.xml": "<workbook/>", "xl/worksheets/sheet1.xml": worksheet})
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("=2+3"))
        self.assertTrue(result["passed"])
        self.assertEqual(result["formulaCells"], [])

    def test_ppt_notes_do_not_count_as_editable_slide_content(self):
        slide = f'<slide xmlns:a="{corpus.A[1:-1]}"><a:t>Title only</a:t></slide>'
        note = f'<notes xmlns:a="{corpus.A[1:-1]}"><a:t>LAST-993</a:t></notes>'
        path = self.office(".pptx", {"ppt/presentation.xml": "<presentation/>", "ppt/slides/slide1.xml": slide,
                                   "ppt/notesSlides/notesSlide1.xml": note})
        result = corpus.inspect_office(path, ".pptx", corpus.markers("LAST-993"))
        self.assertFalse(result["passed"])
        self.assertTrue(result["notesMarkerCheck"]["passed"])

    def test_recovery_representation_does_not_duplicate_primary_markers(self):
        path = self.spreadsheet([["LAST_993"]], ["LAST_993"])
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("LAST_993"))
        self.assertTrue(result["passed"])
        self.assertEqual(result["markerCheck"]["counts"][0]["actual"], 1)

    def test_duplicate_inside_primary_still_fails(self):
        path = self.spreadsheet([["LAST_993"], ["LAST_993"]], ["LAST_993"])
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("LAST_993"))
        self.assertFalse(result["passed"])
        self.assertEqual(result["markerCheck"]["duplicated"][0]["actual"], 2)

    def test_recovery_page_metadata_does_not_split_source_phrase(self):
        path = self.spreadsheet([["unrelated"]], ["कुल राश", "ि", "document", "quality"])
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("कुल राशि", "document quality"))
        self.assertTrue(result["passed"])
        self.assertFalse(result["primaryMarkerCheck"]["passed"])
        self.assertTrue(result["recoveryMarkerCheck"]["passed"])

    def test_recovery_cannot_mask_wrong_typed_french_decimal(self):
        path = self.spreadsheet([["Crème brûlée", 1250]], ["Crème brûlée", "12,50"])
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("Crème brûlée", "12,50"), "french-invoice")
        self.assertTrue(result["markerCheck"]["passed"])
        self.assertFalse(result["semanticChecks"][0]["passed"])
        self.assertFalse(result["passed"])
        path = self.spreadsheet([["Crème brûlée", 12.5]], ["Crème brûlée", "12,50"])
        self.assertTrue(corpus.inspect_office(path, ".xlsx", corpus.markers("Crème brûlée", "12,50"), "french-invoice")["passed"])

    def test_recovery_cannot_mask_numeric_identifier_losing_leading_zero(self):
        path = self.spreadsheet([["Artikelkennung", 1234]], ["001234"])
        result = corpus.inspect_office(path, ".xlsx", corpus.markers("001234"), "german-invoice")
        self.assertTrue(result["markerCheck"]["passed"])
        self.assertFalse(result["semanticChecks"][0]["passed"])
        self.assertFalse(result["passed"])
        path = self.spreadsheet([["Artikelkennung", "001234"]], ["001234"])
        self.assertTrue(corpus.inspect_office(path, ".xlsx", corpus.markers("001234"), "german-invoice")["passed"])

    def test_missing_office_part_and_invalid_zip_fail(self):
        path = self.office(".docx", {})
        with self.assertRaisesRegex(ValueError, "Missing required Office XML"):
            corpus.inspect_office(path, ".docx", corpus.markers("hello"))
        path.write_bytes(b"not a zip, but HTTP status was 200")
        with self.assertRaises(zipfile.BadZipFile):
            corpus.inspect_office(path, ".docx", corpus.markers("hello"))

    def test_loopback_only_transport_rejects_remote_and_credentials(self):
        for url in ("https://onlymypdf.com", "http://127.0.0.1.example.com", "http://user:secret@localhost", "file:///tmp/doc", "http://localhost/path"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                corpus.validate_base_url(url)
        self.assertEqual(corpus.validate_base_url("http://127.0.0.1:3001/"), "http://127.0.0.1:3001")


if __name__ == "__main__":
    unittest.main()
