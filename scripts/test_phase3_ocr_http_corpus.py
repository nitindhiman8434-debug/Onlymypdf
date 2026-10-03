"""Strict OCR corpus validation contracts; no OCR engine, server or LibreOffice needed."""
import importlib.util
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import fitz

spec = importlib.util.spec_from_file_location("ocr_http_corpus", Path(__file__).with_name("phase3-ocr-http-corpus.py"))
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class OcrHttpCorpusTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        patcher = patch.object(corpus, "ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def pdf(self, texts):
        with fitz.open() as pdf:
            for text in texts:
                page = pdf.new_page()
                if text:
                    page.insert_text((60, 60), text)
            return pdf.tobytes()

    def docx(self, body):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<w:document xmlns:w="' + corpus.W[1:-1] + '"><w:body>' + body + '</w:body></w:document>')
        return stream.getvalue()

    def case(self, *markers, pages=1):
        return {"markers": corpus.shared.markers(*markers), "source": {"pages": pages}}

    def test_hindi_conjuncts_are_exact_not_fuzzy(self):
        case = self.case("क्षेत्र", "श्रद्धा", "12345.67")
        bad = self.docx("<w:p><w:r><w:t>क्षेत श्रद्धा 1234567</w:t></w:r></w:p>")
        result = corpus.inspect_output(bad, corpus.DOCX_MIME, "pdf-to-word", case, self.root / "bad.docx")
        self.assertFalse(result["passed"])
        self.assertEqual([item["text"] for item in result["markerCheck"]["missing"]], ["क्षेत्र", "12345.67"])

    def test_editable_hindi_split_across_runs_passes(self):
        body = "<w:p><w:r><w:t>क्षे</w:t></w:r><w:r><w:t>त्र श्रद्धा 12345.67</w:t></w:r></w:p>"
        result = corpus.inspect_output(self.docx(body), corpus.DOCX_MIME, "pdf-to-word", self.case("क्षेत्र", "श्रद्धा", "12345.67"), self.root / "ok.docx")
        self.assertTrue(result["passed"])

    def test_image_alt_text_cannot_pass_editable_word_gate(self):
        body = '<w:p><w:r><w:drawing><description>58324</description></w:drawing></w:r></w:p>'
        result = corpus.inspect_output(self.docx(body), corpus.DOCX_MIME, "pdf-to-word", self.case("58324"), self.root / "image.docx")
        self.assertFalse(result["passed"])
        self.assertEqual(result["editableCharacters"], 0)

    def test_duplicate_marker_fails(self):
        body = "<w:p><w:r><w:t>58324 58324</w:t></w:r></w:p>"
        result = corpus.inspect_output(self.docx(body), corpus.DOCX_MIME, "pdf-to-word", self.case("58324"), self.root / "duplicate.docx")
        self.assertFalse(result["passed"])
        self.assertEqual(result["markerCheck"]["duplicated"][0]["actual"], 2)

    def test_amount_cannot_match_inside_larger_or_signed_value(self):
        expected = corpus.shared.markers("12345.67")
        for value in ("912345.67", "12345.670", "12345.679", "-12345.67", "−12345.67", "1,12345.67", "12345.67,0"):
            with self.subTest(value=value):
                result = corpus.marker_check("Amount " + value + " rupees", expected)
                self.assertFalse(result["passed"])
                self.assertEqual(result["counts"][0]["actual"], 0)
        self.assertTrue(corpus.marker_check("Amount 12345.67 rupees", expected)["passed"])

    def test_numeric_identifier_cannot_match_extra_leading_or_trailing_digits(self):
        expected = corpus.shared.markers("48219")
        for value in ("048219", "948219", "482190", "48219.5"):
            with self.subTest(value=value):
                self.assertFalse(corpus.marker_check("Invoice " + value, expected)["passed"])
        self.assertTrue(corpus.marker_check("Invoice 48219 total", expected)["passed"])

    def test_http_200_invalid_office_zip_does_not_pass(self):
        with self.assertRaisesRegex(ValueError, "not ZIP"):
            corpus.inspect_output(b"HTTP success is not an artifact", corpus.DOCX_MIME, "pdf-to-word", self.case("58324"), self.root / "bad.docx")

    def test_correct_data_wrong_mime_does_not_pass(self):
        with self.assertRaisesRegex(ValueError, "MIME"):
            corpus.inspect_output(self.pdf(["58324"]), "text/html", "ocr-pdf", self.case("58324"), self.root / "bad.pdf")

    def test_missing_output_page_fails(self):
        result = corpus.inspect_output(self.pdf(["58324"]), "application/pdf", "ocr-pdf", self.case("58324", pages=2), self.root / "missing.pdf")
        self.assertFalse(result["passed"])
        self.assertFalse(result["pageCountPassed"])

    def test_success_with_unsearchable_second_page_fails(self):
        result = corpus.inspect_output(self.pdf(["58324", ""]), "application/pdf", "ocr-pdf", self.case("58324", pages=2), self.root / "partial.pdf")
        self.assertFalse(result["passed"])
        self.assertFalse(result["everyPageSearchable"])

    def test_existing_text_preservation_checks_more_than_selected_markers(self):
        case = {**self.case("58324"), "expectedText": "Invoice 58324 original amount 1475.25"}
        result = corpus.inspect_output(self.pdf(["Invoice 58324 changed amount 1475.25"]), "application/pdf", "ocr-pdf", case, self.root / "changed.pdf")
        self.assertTrue(result["markerCheck"]["passed"])
        self.assertFalse(result["existingTextPreservedExactly"])
        self.assertFalse(result["passed"])

    def test_existing_text_exactly_preserved_passes(self):
        text = "Invoice 58324 original amount 1475.25"
        case = {**self.case("58324", "1475.25"), "expectedText": text}
        result = corpus.inspect_output(self.pdf([text]), "application/pdf", "ocr-pdf", case, self.root / "preserved.pdf")
        self.assertTrue(result["passed"])

    def test_expected_rejection_requires_real_422_json_error(self):
        body = b'{"error":"PDF OCR could not recognize readable text on page 1. Try a clearer scan or supported language."}'
        for status in (200, 400, 429, 500):
            self.assertFalse(corpus.expected_rejection(status, body, "application/json")["passed"])
        self.assertFalse(corpus.expected_rejection(422, b"%PDF-success", "application/pdf")["passed"])
        self.assertFalse(corpus.expected_rejection(422, b'{"error":""}', "application/json")["passed"])
        self.assertTrue(corpus.expected_rejection(422, body, "application/json; charset=utf-8")["passed"])
    def test_typed_word_unreadable_422_matches_current_converter_contract(self):
        word = b'{"error":"PDF OCR could not extract enough readable text. Try a clearer scan or supported OCR language."}'
        self.assertTrue(corpus.expected_rejection(422, word, "application/json")["passed"])

    def test_wrong_422_reason_cannot_pass_unreadable_gate(self):
        for body in (b'{"error":"Incorrect password. Please try again."}',
                     b'{"error":"Tesseract is unavailable."}',
                     b'{"error":"Missing OCR language data: hin"}',
                     b'{"error":"PDF OCR is temporarily unavailable. Please try again later."}',
                     b'{"error":"This scan exceeds the OCR page limit. Split the PDF into smaller files and try again."}',
                     b'{"error":"PDF OCR could not extract editable text. Try a clearer scan or supported OCR language."}',
                     b'{"error":"Invalid PDF file."}'):
            with self.subTest(body=body):
                result = corpus.expected_rejection(422, body, "application/json")
                self.assertFalse(result["passed"])
                self.assertFalse(result["unreadableReasonMatched"])

    def test_image_only_fixture_rejects_hidden_source_answers(self):
        path = self.root / "source.pdf"
        path.write_bytes(self.pdf(["58324"]))
        self.assertFalse(corpus.source_state(path, 1, True)["passed"])
        path.write_bytes(self.pdf([""]))
        self.assertTrue(corpus.source_state(path, 1, True)["passed"])

    def test_request_contains_pixels_and_languages_but_not_expected_answers(self):
        path = self.root / "input.pdf"
        path.write_bytes(self.pdf([""]))
        payload, content_type = corpus.multipart(path, "eng+hin")
        self.assertIn(b'eng+hin', payload)
        self.assertIn(b'application/pdf', payload)
        self.assertNotIn("क्षेत्र".encode(), payload)
        self.assertNotIn(b'12345.67', payload)
        self.assertIn("multipart/form-data", content_type)

    def test_loopback_url_policy_is_reused_without_remote_loophole(self):
        for url in ("https://example.com", "http://127.0.0.1.example.com", "http://name:secret@localhost", "http://localhost/path", "http://localhost/?x=1"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                corpus.shared.validate_base_url(url)
        self.assertEqual(corpus.shared.validate_base_url("http://127.0.0.1:3001/"), "http://127.0.0.1:3001")

    def test_localhost_redirect_cannot_change_origin(self):
        handler = corpus.shared.LoopbackRedirectHandler("http://127.0.0.1:3001")
        for url in ("https://example.com/result", "http://127.0.0.1:9000/result"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                handler.redirect_request(None, None, 302, "Found", {}, url)


if __name__ == "__main__":
    unittest.main()
