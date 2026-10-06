"""Offline exact-content and topology contracts for two-table English documents."""
import copy
import importlib.util
import io
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

spec = importlib.util.spec_from_file_location("english_multitable_corpus", Path(__file__).with_name("phase3-english-multitable-corpus.py"))
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class EnglishMultitableCorpusTests(unittest.TestCase):
    def setUp(self):
        self.case = corpus.definitions()[0]

    def p(self, text):
        return "<w:p><w:r><w:t>" + escape(text) + "</w:t></w:r></w:p>"

    def tbl(self, rows):
        return "<w:tbl>" + "".join("<w:tr>" + "".join("<w:tc>" + self.p(cell) + "</w:tc>" for cell in row) + "</w:tr>" for row in rows) + "</w:tbl>"

    def body(self, case=None):
        return "".join(self.tbl(block["rows"]) if block["kind"] == "table" else self.p(block["text"])
                       for page in (case or self.case)["pages"] for block in page)

    def check(self, body, case=None):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<w:document xmlns:w="' + corpus.table.W[1:-1] + '"><w:body>' + body + "</w:body></w:document>")
        return corpus.inspect_docx(output.getvalue(), case or self.case)

    def test_two_complete_tables_with_intervening_prose_pass(self):
        result = self.check(self.body())
        self.assertTrue(result["passed"])
        self.assertEqual(result["nativeTables"]["actualTableCount"], 2)
        self.assertEqual([len(matrix) for matrix in result["nativeTables"]["actualMatrices"]], [4, 4])

    def test_second_table_as_paragraphs_fails_even_with_complete_text(self):
        rows = corpus.expected_tables(self.case)[1]
        result = self.check(self.body().replace(self.tbl(rows), "".join(self.p(" ".join(row)) for row in rows)))
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_both_tables_as_paragraphs_fail(self):
        body = self.body()
        for rows in corpus.expected_tables(self.case):
            body = body.replace(self.tbl(rows), "".join(self.p(" ".join(row)) for row in rows))
        result = self.check(body)
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["passed"])

    def test_merging_two_tables_into_one_fails(self):
        first, second = corpus.expected_tables(self.case)
        body = self.body().replace(self.tbl(first), self.tbl(first + second)).replace(self.tbl(second), "")
        result = self.check(body)
        self.assertEqual(result["nativeTables"]["actualTableCount"], 1)
        self.assertFalse(result["passed"])

    def test_swapped_tables_fail_even_with_same_numeric_inventory(self):
        wrong = copy.deepcopy(self.case)
        wrong["pages"][0][2], wrong["pages"][0][5] = wrong["pages"][0][5], wrong["pages"][0][2]
        result = self.check(self.body(wrong))
        self.assertTrue(all(item["passed"] for item in result["content"]["numericValues"]))
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_middle_paragraph_moved_after_both_tables_fails(self):
        paragraph = self.p(self.case["interTableParagraph"])
        result = self.check(self.body().replace(paragraph, "") + paragraph)
        self.assertTrue(result["nativeTables"]["passed"])
        self.assertFalse(result["content"]["passed"])

    def test_middle_paragraph_duplicated_fails(self):
        paragraph = self.p(self.case["interTableParagraph"])
        self.assertFalse(self.check(self.body().replace(paragraph, paragraph * 2))["passed"])

    def test_repeated_service_rows_must_keep_their_own_amount(self):
        body = self.body().replace("135.30", "TEMP").replace("145.30", "135.30").replace("TEMP", "145.30")
        result = self.check(body)
        self.assertTrue(all(item["passed"] for item in result["content"]["numericValues"]))
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_repeated_second_header_cannot_be_dropped(self):
        first, second = corpus.expected_tables(self.case)
        result = self.check(self.body().replace(self.tbl(second), self.tbl(second[1:])))
        self.assertFalse(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_second_table_duplicate_fails(self):
        second = self.tbl(corpus.expected_tables(self.case)[1])
        result = self.check(self.body().replace(second, second * 2))
        self.assertFalse(result["passed"])

    def test_last_paragraph_cannot_be_dropped(self):
        result = self.check(self.body().replace(self.p(self.case["pages"][0][-1]["text"]), ""))
        self.assertTrue(result["nativeTables"]["passed"])
        self.assertFalse(result["passed"])

    def test_leading_zero_loss_in_second_table_fails(self):
        self.assertFalse(self.check(self.body().replace("00235</w:t>", "235</w:t>"))["passed"])

    def test_changed_decimal_in_second_table_fails(self):
        self.assertFalse(self.check(self.body().replace("320.50", "320.05"))["passed"])

    def test_wrapped_descriptions_in_both_tables_keep_cell_association(self):
        case = corpus.definitions()[1]
        body = self.body(case).replace("research team", "research\n team").replace("for the project", "for the\n project")
        self.assertTrue(self.check(body, case)["passed"])
        self.assertFalse(self.check(body.replace("research\n team", "researchteam"), case)["passed"])

    def test_borderless_two_groups_pass_only_without_native_tables(self):
        case = corpus.definitions()[3]
        self.assertTrue(self.check(self.body(case), case)["passed"])
        rows = [[block["text"]] for block in case["pages"][0]]
        result = self.check(self.tbl(rows), case)
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["nativeTables"]["passed"])

    def test_landscape_one_page_contract_rejects_orientation_change(self):
        case = corpus.definitions()[2]
        text = ["\n".join(corpus.word.page_text(case["pages"][0]))]
        good = corpus.word.rendered_checks(text, case, [{"widthPoints": 792, "heightPoints": 612}])
        self.assertTrue(good["passed"])
        bad = corpus.word.rendered_checks(text, case, [{"widthPoints": 612, "heightPoints": 792}])
        self.assertFalse(bad["passed"])

    def test_spilling_second_table_to_an_extra_page_fails(self):
        blocks = self.case["pages"][0]
        pages = ["\n".join(corpus.word.page_text(blocks[:4])), "\n".join(corpus.word.page_text(blocks[4:]))]
        result = corpus.word.rendered_checks(pages, self.case, [{"widthPoints": 612, "heightPoints": 792}] * 2)
        self.assertFalse(result["passed"])


if __name__ == "__main__":
    unittest.main()
