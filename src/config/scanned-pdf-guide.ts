import { APP_NAME, APP_URL } from "@/config/constants";

export const SCANNED_PDF_GUIDE = {
  path: "/guides/scanned-pdf-to-word",
  title: "Scanned PDF to Word: OCR Guide",
  description: "Choose searchable PDF or editable Word for a scanned document. Follow OnlyMyPDF's OCR steps, understand tested table support and check your converted file.",
  publishedOn: "7 October 2026",
  publishedOnIso: "2026-10-07",
  shortAnswer: "Choose PDF to Word when you need to edit the wording or supported table cells. Choose OCR PDF when you want to search and copy text while keeping a PDF. OCR recognizes text in the scan; it does not guarantee an exact reconstruction of the original layout.",
  sourceUrl: "https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html",
  wordSteps: [
    { name: "Select your PDF", text: "Open PDF to Word and choose Select file. Use the clearest PDF you have and check the upload limit shown by the tool." },
    { name: "Convert to Word", text: "Choose Convert to Word and enter the document password if requested. Readable scans can use OCR automatically; this page has no separate OCR switch or language selector." },
    { name: "Download and review", text: "Choose Download DOCX. Open the file in Word or another DOCX editor, then compare the text, tables and final page with your original." },
  ],
  pdfSteps: [
    { name: "Select your PDF", text: "Open OCR PDF and choose Select file. If the tool rejects the file or its page count, use a shorter representative sample within the displayed limits." },
    { name: "Choose the document language", text: "For an English scan, select English under Document language, then choose Make PDF Searchable." },
    { name: "Check the downloaded PDF", text: "Choose Download Searchable PDF. Search for a word you can see on each page and copy a few lines to check the recognized text." },
  ],
  reviewChecks: [
    { title: "Words and reading order", text: "Compare headings, sentences and the text around each table. Look for skipped lines, repeated words and paragraphs in the wrong order." },
    { title: "Numbers and cell placement", text: "Check decimal points, minus signs, dates and leading zeros in IDs. Confirm each description, quantity and amount stays in its own row and column." },
    { title: "Every page", text: "Inspect every page, paying special attention to the first and last, and to pages with a different size or orientation. In Word, content can reflow onto more pages, so compare content rather than page count alone." },
    { title: "The type of output", text: "In Word, try editing the words and clicking inside table cells. In a searchable PDF, test search and copy; a text layer does not make the page a Word document." },
  ],
  problems: [
    { title: "The scan is rejected or words are missing", text: "Check that the original text is readable. Use a sharper, straighter scan with an even, light background. A cleaner source can help; repeating the same poor input may produce the same errors." },
    { title: "The Word layout looks different", text: "OCR text can reflow. Fonts, line breaks, spacing and page count may differ. If you mainly need search and copy within a PDF, try OCR PDF and review its result." },
    { title: "A table becomes ordinary text", text: "The demonstrated table cases have complete visible grid lines. Merged cells, side-by-side tables, broken rules and borderless invoices are outside that evidence. Review the text or rebuild the table in your editor." },
  ],
  faqs: [
    { question: "Can I convert a scanned PDF directly to Word?", answer: "Yes. Upload the PDF in PDF to Word and choose Convert to Word. Readable scans can use OCR automatically. Download DOCX and review the result; an unreadable or unsupported scan may be rejected." },
    { question: "Do I need OCR PDF before PDF to Word?", answer: "No extra OCR step is required by the PDF to Word workflow. Use it directly when you want DOCX. Choose OCR PDF when your intended output is a searchable PDF instead." },
    { question: "Will every scanned table become editable cells?", answer: "No. The local evidence covers clean ruled English tables, including up to two vertically separated tables on a page. It does not establish support for every invoice, merged cells or borderless table. Check each row and amount in the downloaded file." },
    { question: "Does PDF Scanner make text searchable?", answer: "No. PDF Scanner creates an image-based PDF from images or camera captures. To add searchable text, use the resulting PDF in OCR PDF. For an editable document, use PDF to Word." },
    { question: "Why can a scanned PDF already have selectable text?", answer: "An earlier OCR step may have added a text layer to the page image. Try selecting and copying a line from several pages. Check the copied text: being selectable does not prove that it was recognized correctly." },
  ],
} as const;

export function scannedPdfGuideArticle() {
  const url = `${APP_URL}${SCANNED_PDF_GUIDE.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: SCANNED_PDF_GUIDE.title,
    description: SCANNED_PDF_GUIDE.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: SCANNED_PDF_GUIDE.publishedOnIso,
    dateModified: SCANNED_PDF_GUIDE.publishedOnIso,
    inLanguage: "en",
    author: { "@type": "Organization", name: APP_NAME, url: `${APP_URL}/about` },
    publisher: { "@type": "Organization", name: APP_NAME, url: APP_URL },
    citation: [`${APP_URL}/benchmarks#ocr-results`, SCANNED_PDF_GUIDE.sourceUrl],
  };
}
