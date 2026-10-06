"""Exact native table validation contracts; no HTTP, OCR or fixture generation."""
import copy
import importlib.util
import io
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

spec = importlib.util.spec_from_file_location("english_table_corpus", Path(__file__).with_name("phase3-english-table-corpus.py"))
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class EnglishTableCorpusTests(unittest.TestCase):
    def setUp(self):
        self.case = corpus.definitions()[0]

    def paragraph(self, text):
        return "<w:p><w:r><w:t>" + escape(text) + "</w:t></w:r></w:p>"

    def table(self, rows):
        return "<w:tbl>" + "".join("<w:tr>" + "".join("<w:tc>" + self.paragraph(cell) + "</w:tc>" for cell in row) + "</w:tr>" for row in rows) + "</w:tbl>"

    def body(self, case=None, table_transform=None):
        case = case or self.case
        result = ""
        for page in case["pages"]:
            for block in page:
                if block["kind"] == "table":
                    result += table_transform(block["rows"]) if table_transform else self.table(block["rows"])
                else:
                    result += self.paragraph(block["text"])
        return result

    def docx(self, body):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<w:document xmlns:w="' + corpus.W[1:-1] + '"><w:body>' + body + "</w:body></w:document>")
        return output.getvalue()

    def check(self, body, case=None):
        return corpus.inspect_docx(self.docx(body), case or self.case)

    def test_exact_header_three_rows_and_surrounding_text_pass(self):
        result = self.check(self.body())
        self.assertTrue(result["passed"])
        self.assertEqual(result["nativeTables"]["actualTableCount"], 1)
        self.assertEqual(len(result["nativeTables"]["actualMatrices"][0]), 4)

    def test_paragraph_only_invoice_fails_even_when_text_is_complete(self):
        body = self.body(table_transform=lambda rows: "".join(self.paragraph(" ".join(row)) for row in rows))
        result = self.check(body)
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_changed_amount_fails(self):
        result = self.check(self.body().replace("240.50", "240.60"))
        self.assertFalse(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_swapped_amounts_fail_even_when_numeric_inventory_matches(self):
        body = self.body().replace("240.50", "PLACEHOLDER").replace("135.30", "240.50").replace("PLACEHOLDER", "135.30")
        result = self.check(body)
        self.assertTrue(all(item["passed"] for item in result["content"]["numericValues"]))
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_leading_zero_loss_fails(self):
        self.assertFalse(self.check(self.body().replace("00421</w:t>", "421</w:t>"))["passed"])

    def test_duplicate_table_fails(self):
        result = self.check(self.body() + self.table(corpus.expected_tables(self.case)[0]))
        self.assertEqual(result["nativeTables"]["actualTableCount"], 2)
        self.assertFalse(result["passed"])

    def test_duplicate_surrounding_text_fails(self):
        result = self.check(self.body() + self.paragraph(self.case["pages"][0][-1]["text"]))
        self.assertTrue(result["nativeTables"]["passed"])
        self.assertFalse(result["content"]["passed"])
        self.assertFalse(result["passed"])

    def test_exact_native_table_with_duplicate_paragraph_transcript_fails(self):
        rows = corpus.expected_tables(self.case)[0]
        body = self.body() + "".join(self.paragraph(" ".join(row)) for row in rows)
        self.assertFalse(self.check(body)["passed"])

    def test_same_words_with_wrong_cell_boundaries_fail(self):
        def wrong_cells(rows):
            return self.table([[" ".join(row[:2]), row[2], row[3]] for row in rows])
        result = self.check(self.body(table_transform=wrong_cells))
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])

    def test_missing_header_fails(self):
        result = self.check(self.body(table_transform=lambda rows: self.table(rows[1:])))
        self.assertFalse(result["nativeTables"]["passed"])

    def test_extra_empty_native_table_fails(self):
        result = self.check(self.body() + self.table([[""]]))
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])

    def test_merge_property_cannot_hide_wrong_topology(self):
        body = self.body().replace("<w:tc>", '<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>', 1)
        result = self.check(body)
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])

    def test_hidden_cell_text_cannot_satisfy_native_matrix(self):
        body = self.body().replace("<w:t>240.50</w:t>", "<w:rPr><w:vanish/></w:rPr><w:t>240.50</w:t>")
        self.assertFalse(self.check(body)["passed"])

    def test_wrapped_cell_whitespace_preserves_exact_value(self):
        case = corpus.definitions()[1]
        body = self.body(case).replace("Monthly analysis and reporting", "Monthly analysis\n and reporting")
        self.assertTrue(self.check(body, case)["passed"])

    def test_wrapped_cell_cannot_delete_word_spaces(self):
        case = corpus.definitions()[1]
        body = self.body(case).replace("Monthly analysis", "Monthlyanalysis")
        self.assertFalse(self.check(body, case)["passed"])

    def test_negative_borderless_memo_requires_zero_tables(self):
        case = corpus.definitions()[3]
        self.assertTrue(self.check(self.body(case), case)["passed"])
        body = self.table([[block["text"]] for block in case["pages"][0]])
        result = self.check(body, case)
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_two_page_table_order_is_strict(self):
        case = corpus.definitions()[2]
        self.assertTrue(self.check(self.body(case), case)["passed"])
        wrong = copy.deepcopy(case)
        wrong["pages"].reverse()
        self.assertFalse(self.check(self.body(wrong), case)["passed"])

    def test_missing_last_page_fails_render(self):
        case = corpus.definitions()[2]
        texts = ["\n".join(corpus.word.page_text(case["pages"][0]))]
        result = corpus.word.rendered_checks(texts, case, [{"widthPoints": 612, "heightPoints": 792}])
        self.assertFalse(result["passed"])

    def test_second_page_wrong_orientation_fails_render(self):
        case = corpus.definitions()[2]
        texts = ["\n".join(corpus.word.page_text(page)) for page in case["pages"]]
        dimensions = [{"widthPoints": 612, "heightPoints": 792}] * 2
        result = corpus.word.rendered_checks(texts, case, dimensions)
        self.assertTrue(all(item["fullTextMatches"] for item in result["perPage"]))
        self.assertFalse(result["passed"])


if __name__ == "__main__":
    unittest.main()
