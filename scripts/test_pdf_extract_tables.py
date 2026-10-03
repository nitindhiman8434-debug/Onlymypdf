"""Regression contracts for source-preserving Excel extraction (no network)."""
import importlib.util
import pathlib
import unittest
from types import SimpleNamespace
import fitz

SPEC = importlib.util.spec_from_file_location(
    "pdf_extract_tables", pathlib.Path(__file__).with_name("pdf-extract-tables.py")
)
extractor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(extractor)


class ExtractionTests(unittest.TestCase):
    def table(self, detected, source):
        page = SimpleNamespace(get_textpage=lambda: None, get_textbox=lambda *args, **kwargs: source)
        return SimpleNamespace(
            page=page, extract=lambda: [[detected]],
            rows=[SimpleNamespace(cells=[(0, 0, 20, 20)])],
        )

    def test_number_spelling_survives_python_extraction(self):
        for value in ["12,50", "001234", "1.234,56", "−12,50", "1 234,56", "1234567890123456", "$1,234"]:
            with self.subTest(value=value):
                self.assertEqual(extractor.normalize_financial_cell(value), value)

    def test_underscores_keep_source_order(self):
        result = extractor.rows_from_table_object(self.table("HINDI 2026 017\n_ _", "HINDI_2026_017"))
        self.assertEqual(result, [["HINDI_2026_017"]])

    def test_indic_vowel_sign_keeps_logical_order(self):
        result = extractor.rows_from_table_object(self.table("कु ल रािश", "कुल राशि"))
        self.assertEqual(result, [["कुल राशि"]])

    def test_glyph_run_line_break_does_not_split_vowel_sign(self):
        self.assertEqual(extractor.clean_cell("कुल राश\nि"), "कुल राशि")
        self.assertEqual(extractor.clean_cell("अंत\nिम संकेत"), "अंतिम संकेत")

    def test_normal_word_and_line_boundaries_are_retained(self):
        self.assertEqual(extractor.clean_cell("one\ntwo", preserve_newlines=True), "one\ntwo")
        self.assertEqual(extractor.clean_cell("one two"), "one two")

    def test_clipped_textbox_cannot_drop_content(self):
        result = extractor.rows_from_table_object(self.table("ABC 123\n_", "ABC_12"))
        self.assertEqual(result, [["ABC 123 _"]])

    def test_textbox_cannot_acquire_adjacent_cell_content(self):
        result = extractor.rows_from_table_object(self.table("ABC 123\n_", "ABC_123 XYZ"))
        self.assertEqual(result, [["ABC 123 _"]])

    def test_reverse_painted_number_retains_visual_reading_order(self):
        # Real PDF: drawing order is 4,3,2,1, but visible left-to-right text is
        # 1234. A same-character comparison alone cannot choose reading order.
        with fitz.open() as document:
            page = document.new_page(width=400, height=200)
            for x in (50, 200, 300):
                page.draw_line((x, 50), (x, 150))
            for y in (50, 100, 150):
                page.draw_line((50, y), (300, y))
            page.insert_text((60, 75), "Item")
            page.insert_text((210, 75), "Amount")
            page.insert_text((60, 125), "Test")
            for character, x in (("4", 228.36), ("3", 222.24), ("2", 216.12), ("1", 210)):
                page.insert_text((x, 125), character)
            table = page.find_tables().tables[0]
            self.assertEqual(table.extract()[1][1], "1234")
            self.assertEqual(extractor.rows_from_table_object(table)[1][1], "1234")

    def test_ordinary_latin_cells_keep_geometric_order(self):
        self.assertEqual(extractor.rows_from_table_object(self.table("ABCD", "D C B A")), [["ABCD"]])

    def test_missing_hindi_prose_requires_recovery(self):
        self.assertTrue(extractor.needs_source_text_backup("यह नया काम है। कुल राशि 123", "कुल राशि 123"))

    def test_missing_short_and_repeated_tokens_require_recovery(self):
        self.assertTrue(extractor.needs_source_text_backup("A A 2 2", "A 2"))

    def test_changed_identifier_and_number_require_recovery(self):
        for original, table in [("HINDI_2026_017", "HINDI 2026 017 _ _"), ("12,50", "1250"), ("001234", "1234")]:
            with self.subTest(original=original):
                self.assertTrue(extractor.needs_source_text_backup(original, table))

    def test_matching_unicode_and_numeric_text_needs_no_backup(self):
        self.assertFalse(extractor.needs_source_text_backup("कुल राश\nि 12,50", "कुल राशि 12,50"))

    def test_composed_unicode_equivalents_match(self):
        self.assertFalse(extractor.needs_source_text_backup("Crème", "Cre\u0300me"))


if __name__ == "__main__":
    unittest.main()
