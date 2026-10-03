"""Negative and positive contracts for English Word quality; no server or OCR needed."""
import importlib.util
import io
import unittest
import zipfile

from pathlib import Path
from xml.sax.saxutils import escape

spec = importlib.util.spec_from_file_location("english_word_corpus", Path(__file__).with_name("phase3-english-word-corpus.py"))
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class EnglishWordCorpusTests(unittest.TestCase):
    def case(self, paragraphs=None):
        paragraphs = paragraphs or ["Keep spaces between words.", "The final reference is 006731."]
        return {"pages": [[corpus.p(text) for text in paragraphs]], "numericValues": ["006731"]}

    def docx(self, xml_body, extra_parts=None):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<w:document xmlns:w="' + corpus.W[1:-1] + '"><w:body>' + xml_body + '</w:body></w:document>')
            for path, data in (extra_parts or {}).items():
                archive.writestr(path, data)
        return stream.getvalue()

    def paragraphs(self, *values):
        return "".join("<w:p><w:r><w:t>" + escape(text) + "</w:t></w:r></w:p>" for text in values)

    def dimensions(self, *sizes):
        return [{"widthPoints": width, "heightPoints": height} for width, height in sizes]

    def test_whitespace_is_collapsed_not_removed(self):
        self.assertEqual(corpus.normalize("Keep \n spaces\tbetween words."), "Keep spaces between words.")
        self.assertNotEqual(corpus.normalize("Keep spaces"), corpus.normalize("Keepspaces"))

    def test_joined_words_fail_complete_content(self):
        result = corpus.content_checks("Keepspacesbetweenwords. The final reference is 006731.", self.case())
        self.assertFalse(result["passed"])
        self.assertFalse(result["fullNormalizedTextMatches"])
        self.assertEqual(result["blockOccurrences"][0]["actual"], 0)

    def test_exact_paragraphs_and_identifier_pass(self):
        result = corpus.content_checks("Keep spaces between words.\nThe final reference is 006731.", self.case())
        self.assertTrue(result["passed"])

    def test_complete_phrase_cannot_match_inside_another_word(self):
        self.assertEqual(corpus.phrase_positions("unpaid balance", "paid"), [])
        self.assertEqual(corpus.phrase_positions("paid balance", "paid"), [0])

    def test_duplicate_paragraph_fails_occurrence_count(self):
        result = corpus.content_checks("Keep spaces between words. Keep spaces between words. The final reference is 006731.", self.case())
        self.assertFalse(result["passed"])
        self.assertEqual(result["blockOccurrences"][0]["actual"], 2)

    def test_reordered_paragraphs_fail_even_with_all_words(self):
        result = corpus.content_checks("The final reference is 006731. Keep spaces between words.", self.case())
        self.assertTrue(all(row["actual"] == row["expected"] for row in result["blockOccurrences"]))
        self.assertFalse(result["passed"])
        self.assertFalse(result["orderedBlocks"][1]["passed"])

    def test_amounts_and_identifiers_cannot_match_larger_numbers(self):
        case = {"pages": [[corpus.p("Amount 12345.67 and reference 006731.")]], "numericValues": ["12345.67", "006731"]}
        for wrong in ("912345.67", "12345.670", "12345.67,2", "-12345.67"):
            with self.subTest(wrong=wrong):
                checks = corpus.content_checks("Amount " + wrong + " and reference 006731.", case)
                self.assertFalse(checks["numericValues"][0]["passed"])
        for wrong in ("6731", "1006731", "0067310"):
            with self.subTest(wrong=wrong):
                checks = corpus.content_checks("Amount 12345.67 and reference " + wrong + ".", case)
                self.assertFalse(checks["numericValues"][1]["passed"])

    def test_sentence_period_does_not_change_numeric_value(self):
        case = {"pages": [[corpus.p("Total 12345.67.")]], "numericValues": ["12345.67"]}
        self.assertTrue(corpus.content_checks("Total 12345.67.", case)["passed"])

    def test_invoice_values_must_stay_with_their_row(self):
        rows = [["Analysis", "2", "120.25", "240.50"], ["Review", "3", "45.10", "135.30"]]
        case = {"pages": [[{"kind": "table", "rows": rows}]], "invoiceRows": rows, "numericValues": ["240.50", "135.30"]}
        good = corpus.content_checks("Analysis 2 120.25 240.50\nReview 3 45.10 135.30", case)
        self.assertTrue(good["passed"])
        bad = corpus.content_checks("Analysis 2 120.25 135.30\nReview 3 45.10 240.50", case)
        self.assertTrue(all(row["passed"] for row in bad["numericValues"]))
        self.assertTrue(all(not row["passed"] for row in bad["invoiceRowAssociation"]))
        self.assertFalse(bad["passed"])

    def test_adjacent_runs_are_joined_without_inventing_spaces(self):
        body = '<w:p><w:r><w:t>Keep </w:t></w:r><w:r><w:t>spaces between words.</w:t></w:r></w:p>'
        body += self.paragraphs("The final reference is 006731.")
        self.assertTrue(corpus.inspect_docx(self.docx(body), self.case())["passed"])
        joined = body.replace("Keep </w:t>", "Keep</w:t>")
        self.assertFalse(corpus.inspect_docx(self.docx(joined), self.case())["passed"])

    def test_hidden_and_deleted_text_cannot_satisfy_readable_output(self):
        hidden = '<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Keep spaces between words.</w:t></w:r></w:p>'
        deleted = '<w:del><w:p><w:r><w:t>The final reference is 006731.</w:t></w:r></w:p></w:del>'
        result = corpus.inspect_docx(self.docx(hidden + deleted), self.case())
        self.assertFalse(result["passed"])
        self.assertEqual(result["visibleEditableCharacters"], 0)

    def test_image_alt_text_does_not_count_as_readable_body_text(self):
        body = '<w:p><w:r><w:drawing><description>Keep spaces between words.</description></w:drawing></w:r></w:p>'
        result = corpus.inspect_docx(self.docx(body), self.case())
        self.assertFalse(result["passed"])
        self.assertEqual(result["visibleEditableCharacters"], 0)

    def test_complete_text_with_page_picture_still_fails_layout(self):
        from PIL import Image
        image = io.BytesIO()
        Image.new("RGB", (1224, 1584), "white").save(image, format="PNG")
        body = self.paragraphs("Keep spaces between words.", "The final reference is 006731.")
        result = corpus.inspect_docx(self.docx(body, {"word/media/page.png": image.getvalue()}), self.case())
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["layout"]["passed"])
        self.assertTrue(result["layout"]["unexpectedEmbeddedImages"][0]["pageAspectRatio"])

    def test_side_by_side_image_transcript_wrapper_is_reported(self):
        body = '<w:tbl><w:tr><w:tc><w:p><w:r><w:drawing/></w:r></w:p></w:tc><w:tc>'
        body += self.paragraphs("Keep spaces between words.", "The final reference is 006731.") + '</w:tc></w:tr></w:tbl>'
        result = corpus.inspect_docx(self.docx(body), self.case())
        self.assertTrue(result["content"]["passed"])
        self.assertFalse(result["layout"]["passed"])
        self.assertEqual(result["layout"]["imageTextSideBySideWrappers"], 1)

    def test_two_text_columns_fail_one_column_source_contract(self):
        body = self.paragraphs("Keep spaces between words.", "The final reference is 006731.") + '<w:sectPr><w:cols w:num="2"/></w:sectPr>'
        self.assertFalse(corpus.inspect_docx(self.docx(body), self.case())["layout"]["passed"])

    def test_plain_text_invoice_does_not_claim_native_table_reconstruction(self):
        row = ["Analysis", "2", "120.25", "240.50"]
        case = {"pages": [[{"kind": "table", "rows": [row]}]], "invoiceRows": [row], "numericValues": ["240.50"]}
        result = corpus.inspect_docx(self.docx(self.paragraphs(" ".join(row))), case)
        self.assertTrue(result["passed"])
        self.assertFalse(result["layout"]["nativeInvoiceTableReconstructed"])
        self.assertFalse(result["layout"]["nativeTableReconstructionRequired"])

    def test_controlled_two_page_content_and_orientation_pass(self):
        case = {"pages": [[corpus.p("First page end.")], [corpus.p("Second page end.")]], "pageSizesPoints": [[612, 792], [792, 612]]}
        result = corpus.rendered_checks(["First page end.", "Second page end."], case, self.dimensions((612, 792), (792, 612)))
        self.assertTrue(result["passed"])

    def test_dropped_final_page_cannot_pass(self):
        case = {"pages": [[corpus.p("First page end.")], [corpus.p("Second page end.")]]}
        result = corpus.rendered_checks(["First page end."], case, self.dimensions((612, 792)))
        self.assertFalse(result["passed"])
        self.assertFalse(result["pageCountPassed"])
        self.assertFalse(result["perPage"][1]["fullTextMatches"])

    def test_overflow_page_fails_even_if_every_expected_paragraph_is_present(self):
        case = {"pages": [[corpus.p("First page end.")], [corpus.p("Second page end.")]]}
        result = corpus.rendered_checks(["First page end.", "Second page end.", ""], case, self.dimensions((612, 792), (612, 792), (612, 792)))
        self.assertTrue(all(page["fullTextMatches"] for page in result["perPage"]))
        self.assertFalse(result["pageCountPassed"])
        self.assertFalse(result["passed"])

    def test_inflated_page_geometry_fails_with_correct_words(self):
        case = self.case()
        text = "Keep spaces between words. The final reference is 006731."
        result = corpus.rendered_checks([text], case, self.dimensions((1402.5, 1815)))
        self.assertTrue(result["perPage"][0]["fullTextMatches"])
        self.assertFalse(result["pageGeometry"][0]["passed"])
        self.assertFalse(result["passed"])

    def test_page_geometry_allows_only_one_point_rounding(self):
        case = self.case()
        text = "Keep spaces between words. The final reference is 006731."
        self.assertTrue(corpus.rendered_checks([text], case, self.dimensions((612.9, 791.1)))["passed"])
        self.assertFalse(corpus.rendered_checks([text], case, self.dimensions((613.1, 792)))["passed"])

    def test_moving_second_page_text_to_first_does_not_pass(self):
        case = {"pages": [[corpus.p("First page end.")], [corpus.p("Second page end.")]]}
        result = corpus.rendered_checks(["First page end. Second page end.", ""], case, self.dimensions((612, 792), (612, 792)))
        self.assertTrue(result["pageCountPassed"])
        self.assertFalse(result["passed"])

    def test_invalid_zip_cannot_be_success(self):
        with self.assertRaisesRegex(ValueError, "not ZIP"):
            corpus.inspect_docx(b"not an Office artifact", self.case())

    def test_loopback_restriction_is_preserved(self):
        for url in ("https://example.com", "http://user:secret@localhost", "http://127.0.0.1.evil.test", "http://localhost/path"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                corpus.transport_module.validate_base_url(url)
        self.assertEqual(corpus.transport_module.validate_base_url("http://127.0.0.1:3001/"), "http://127.0.0.1:3001")


if __name__ == "__main__":
    unittest.main()
