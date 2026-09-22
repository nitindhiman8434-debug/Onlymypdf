import type { HowToStep, ToolAeo } from "@/types";
import { compressToolAeoSizeFact } from "@/lib/billing/billing-copy";

function aeo(
  shortAnswer: string,
  definition: string,
  howToSteps: HowToStep[],
  keyFacts: string[]
): ToolAeo {
  return { shortAnswer, definition, howToSteps, keyFacts };
}

export const TOOL_AEO: Record<string, ToolAeo> = {
  "merge-pdf": aeo(
    "OnlyMyPDF Merge PDF combines multiple PDF files into one document in your browser for free. Free users can merge up to 20 files; files are deleted from servers within 2 hours.",
    "Merge PDF is an online tool that joins two or more PDF documents into a single file while preserving original quality, formatting, and page order.",
    [
      { name: "Upload PDFs", text: "Open the Merge PDF tool and upload your PDF files by drag-and-drop or file picker." },
      { name: "Reorder files", text: "Drag files into the order you want pages to appear in the merged document." },
      { name: "Merge and download", text: "Click Merge to combine the files, then download your single merged PDF instantly." },
    ],
    ["Free: up to 20 PDFs per merge", "No software install required", "HTTPS/TLS transfer", "2-hour Free or 24-hour Pro retention window", "Pages are copied without raster recompression"]
  ),
  "split-pdf": aeo(
    "OnlyMyPDF Split PDF extracts pages or page ranges from a PDF into separate files online for free. Choose all pages or custom ranges like 1-3, 5, 8-10.",
    "Split PDF separates one PDF into multiple smaller PDFs by individual pages or custom page ranges, without modifying the original upload.",
    [
      { name: "Upload your PDF", text: "Go to Split PDF and upload the document you want to divide." },
      { name: "Choose pages", text: "Select split-all-pages mode or enter specific page ranges to extract." },
      { name: "Download splits", text: "Click Split and download the resulting PDF files as a ZIP or individual files." },
    ],
    ["Split by page range or every page", "Original upload is not modified", "No software install required", "Free with daily usage limits", "Published file-retention window"]
  ),
  "compress-pdf": aeo(
    "OnlyMyPDF Compress PDF offers a lossless Basic mode and a smaller Strong mode. Strong mode rasterizes pages and can flatten searchable text and interactive content.",
    "Compress PDF applies lossless structural optimization in Basic mode or page rasterization in Strong mode, then reports the actual result size.",
    [
      { name: "Upload PDF", text: "Upload the PDF you want to make smaller." },
      { name: "Pick compression level", text: "Choose Basic for lossless optimization or Strong for larger reductions with page rasterization." },
      { name: "Download compressed PDF", text: "Process the file and download the optimized PDF with the new file size shown." },
    ],
    ["Actual savings depend on document content", "Basic and Strong modes", compressToolAeoSizeFact(), "Server-side processing", "HTTPS/TLS transfer and published retention"]
  ),
  "rotate-pdf": aeo(
    "OnlyMyPDF Rotate PDF turns pages 90°, 180°, or 270° in a visual editor. Rotate one page, multiple selected pages, or bulk-rotate from the toolbar.",
    "Rotate PDF fixes sideways or upside-down pages in a PDF using a page thumbnail workspace before you download the corrected file.",
    [
      { name: "Upload PDF", text: "Open Rotate PDF and upload your document." },
      { name: "Select pages", text: "Click pages to rotate individually or select several with checkboxes for bulk rotation." },
      { name: "Apply and download", text: "Use rotate left/right controls, then download the updated PDF." },
    ],
    ["90°, 180°, and 270° rotation", "Visual page preview", "Bulk rotate supported", "No quality loss", "Free online tool"]
  ),
  "delete-pdf": aeo(
    "OnlyMyPDF Delete PDF Pages removes unwanted pages from a PDF in a visual grid. Delete one page or many at once, then download the trimmed PDF.",
    "Delete PDF Pages lets you remove specific pages from a document while keeping the remaining pages at original quality.",
    [
      { name: "Upload PDF", text: "Upload the PDF containing pages you want to remove." },
      { name: "Select pages to delete", text: "Hover and delete single pages or select multiple pages with checkboxes." },
      { name: "Download result", text: "Confirm deletion and download the PDF without the removed pages." },
    ],
    ["Delete single or multiple pages", "Visual thumbnail workspace", "Remaining pages unchanged", "Can insert pages from other PDFs", "Secure processing"]
  ),
  "extract-pdf": aeo(
    "OnlyMyPDF Extract PDF Pages creates a new PDF from only the pages you select. Click pages in the preview, then finish to download.",
    "Extract PDF Pages copies chosen pages into a new file — including non-consecutive selections — without altering the source PDF.",
    [
      { name: "Upload PDF", text: "Open Extract PDF Pages and upload your file." },
      { name: "Select pages", text: "Click the pages you need; selections can be non-adjacent." },
      { name: "Finish and download", text: "Click Finish to build and download a PDF with only selected pages." },
    ],
    ["Non-consecutive page selection", "Original quality preserved", "Visual page picker", "No signup required for basic use", "Files deleted after retention window"]
  ),
  "pdf-to-word": aeo(
    "OnlyMyPDF PDF to Word converts supported PDF text to editable .docx documents online. Complex forms may keep a visual page reference beside editable text.",
    "PDF to Word extracts editable text with layout-aware engines when supported; review complex layouts and form fields in the downloaded Word file.",
    [
      { name: "Upload PDF", text: "Upload the PDF you want to convert to Word format." },
      { name: "Convert", text: "Start conversion; processing runs securely on OnlyMyPDF servers." },
      { name: "Download DOCX", text: "Download the .docx file and open it in Microsoft Word, Google Docs, or LibreOffice." },
    ],
    ["Outputs .docx format", "Preserves tables and headings when possible", "Scanned PDFs may need OCR first", "Plan file-size limits apply", "Free tier available"]
  ),
  "word-to-pdf": aeo(
    "OnlyMyPDF Word to PDF converts .doc and .docx files to PDF online while preserving fonts, images, tables, and layout.",
    "Word to PDF turns Microsoft Word documents into shareable, print-ready PDF files using server-side rendering.",
    [
      { name: "Upload Word file", text: "Upload a .doc or .docx document." },
      { name: "Convert to PDF", text: "Click convert; the file is processed on secure servers." },
      { name: "Download PDF", text: "Download the generated PDF and preview it in the browser if needed." },
    ],
    ["Supports .doc and .docx", "Formatting preserved", "Browser preview available", "No install required", "Encrypted upload"]
  ),
  "pdf-to-excel": aeo(
    "OnlyMyPDF PDF to Excel converts PDF tables and data into .xlsx spreadsheets you can edit in Excel or Google Sheets.",
    "PDF to Excel extracts tabular data from PDFs into spreadsheet format for analysis and editing.",
    [
      { name: "Upload PDF", text: "Upload a PDF containing tables or structured data." },
      { name: "Convert", text: "Run PDF to Excel conversion on the server." },
      { name: "Download XLSX", text: "Download the Excel file and edit cells in your spreadsheet app." },
    ],
    ["Outputs .xlsx", "Best for table-heavy PDFs", "Free online conversion", "HTTPS/TLS transfer", "Published file-retention window"]
  ),
  "excel-to-pdf": aeo(
    "OnlyMyPDF Excel to PDF converts .xls and .xlsx spreadsheets into PDF documents with layout preserved for sharing and printing.",
    "Excel to PDF renders spreadsheet workbooks as fixed-layout PDF files suitable for distribution.",
    [
      { name: "Upload spreadsheet", text: "Upload an Excel .xls or .xlsx file." },
      { name: "Convert", text: "Process the workbook into PDF format." },
      { name: "Download PDF", text: "Save the PDF output to your device." },
    ],
    ["Supports .xls and .xlsx", "Print-ready PDF output", "No desktop software needed", "Free tier available", "SSL encrypted uploads"]
  ),
  "pdf-to-ppt": aeo(
    "OnlyMyPDF PDF to PowerPoint creates editable on-slide text for simple pages. Dense pages retain a visual slide and place extracted text in editable speaker notes; scans remain visual.",
    "PDF to PowerPoint turns PDF content into presentation slides, useful for reusing PDF visuals in decks.",
    [
      { name: "Upload PDF", text: "Upload the PDF you want as a presentation." },
      { name: "Convert", text: "Start PDF to PowerPoint conversion." },
      { name: "Download PPTX", text: "Download the .pptx file and refine slides in your presentation app." },
    ],
    ["Outputs .pptx", "Page-based slide generation", "Online — no install", "Secure processing", "Free usage limits apply"]
  ),
  "ppt-to-pdf": aeo(
    "OnlyMyPDF PowerPoint to PDF converts .ppt and .pptx presentations into PDF for sharing, archiving, or printing.",
    "PowerPoint to PDF flattens slides into a universal PDF document while preserving slide layout.",
    [
      { name: "Upload presentation", text: "Upload a .ppt or .pptx file." },
      { name: "Convert", text: "Convert slides to PDF on OnlyMyPDF servers." },
      { name: "Download PDF", text: "Download the finished PDF presentation." },
    ],
    ["Supports .ppt and .pptx", "Shareable PDF output", "Browser-based", "Encrypted transfer", "Auto-deletion policy"]
  ),
  "jpg-to-pdf": aeo(
    "OnlyMyPDF JPG to PDF converts JPG, PNG, WebP, and GIF images into a single PDF. Upload up to 20 images and merge them into one document.",
    "JPG to PDF combines image files into a PDF album or document, ideal for scans, photos, and graphics.",
    [
      { name: "Upload images", text: "Upload one or more image files (JPG, PNG, WebP, GIF)." },
      { name: "Arrange order", text: "Reorder images if you want a specific page sequence." },
      { name: "Create PDF", text: "Generate and download the combined PDF." },
    ],
    ["Multiple images per PDF", "Common image formats supported", "Free online tool", "No software install", "Secure uploads"]
  ),
  "html-to-pdf": aeo(
    "OnlyMyPDF HTML to PDF converts web pages and HTML files into PDF documents with styles and layout rendered for print or archive.",
    "HTML to PDF captures HTML content — from files or URLs — as a portable PDF.",
    [
      { name: "Provide HTML", text: "Upload an HTML file or paste a URL depending on the tool input." },
      { name: "Convert", text: "Render the HTML to PDF on the server." },
      { name: "Download PDF", text: "Save the generated PDF to your device." },
    ],
    ["URL or file input", "Server-side rendering", "Useful for reports and archives", "Free tier", "Encrypted processing"]
  ),
  "txt-to-pdf": aeo(
    "OnlyMyPDF TXT to PDF converts plain text files into formatted PDF documents for sharing and printing.",
    "TXT to PDF wraps plain text in a readable PDF layout without needing a word processor.",
    [
      { name: "Upload text file", text: "Upload a .txt file." },
      { name: "Convert", text: "Process the text into PDF format." },
      { name: "Download PDF", text: "Download the PDF version of your text file." },
    ],
    ["Simple text to PDF", "Fast conversion", "Browser-based", "No install", "Secure file deletion"]
  ),
  "sign-pdf": aeo(
    "OnlyMyPDF Sign PDF lets you draw, type, or upload a signature and place it on any page of a PDF online. Pro feature with legally useful e-sign workflow.",
    "Sign PDF adds electronic signatures to PDF contracts and forms in a visual editor before export.",
    [
      { name: "Upload PDF", text: "Upload the PDF you need to sign." },
      { name: "Add signature", text: "Draw, type, or upload your signature and position it on the page." },
      { name: "Download signed PDF", text: "Export and download the PDF with your signature applied." },
    ],
    ["Draw, type, or image signature", "Place signature on any page", "Pro plan feature", "Visual placement editor", "Secure processing"]
  ),
  "add-watermark": aeo(
    "OnlyMyPDF Add Watermark stamps text or image watermarks across all pages of a PDF for branding or draft marking.",
    "Add Watermark overlays repeated text or logo watermarks on a PDF for confidentiality or branding.",
    [
      { name: "Upload PDF", text: "Upload the PDF to watermark." },
      { name: "Configure watermark", text: "Set text or image, opacity, rotation, and position." },
      { name: "Apply and download", text: "Apply the watermark to all pages and download the result." },
    ],
    ["Text or image watermarks", "Applies to all pages", "Opacity and angle controls", "Free online tool", "Published file-retention window"]
  ),
  "ai-pdf-summarizer": aeo(
    "OnlyMyPDF AI PDF Summarizer reads a PDF and generates a concise summary with key points, action items, and dates. Available on the Pro plan.",
    "AI PDF Summarizer uses AI models to extract the main ideas from long PDF documents without reading every page manually.",
    [
      { name: "Sign in", text: "Log in with a Pro account — summarizer requires authentication." },
      { name: "Upload PDF", text: "Upload the document to summarize." },
      { name: "Get summary", text: "Run AI summarization and read or export the generated summary." },
    ],
    ["1 free summary/day with login", "Unlimited on Pro", "Key points and action items", "AI-powered analysis", "Summaries for informational use"]
  ),
  "pdf-scanner": aeo(
    "OnlyMyPDF PDF Scanner uses your device camera to capture documents and save them as a clean PDF with edge detection.",
    "PDF Scanner turns phone or webcam photos of documents into PDF pages suitable for sharing or OCR.",
    [
      { name: "Open scanner", text: "Open PDF Scanner and allow camera access." },
      { name: "Capture pages", text: "Photograph each document page; edge detection crops the scan." },
      { name: "Export PDF", text: "Combine captures into one PDF and download." },
    ],
    ["Camera-based capture", "Edge detection", "Multi-page scans", "Free online tool", "Works on mobile browsers"]
  ),
  "unlock-pdf": aeo(
    "OnlyMyPDF Unlock PDF removes known passwords from PDFs you own or are authorized to open, producing an unrestricted copy.",
    "Unlock PDF decrypts password-protected PDFs when you supply the correct password — for documents you have rights to access.",
    [
      { name: "Upload locked PDF", text: "Upload the password-protected PDF." },
      { name: "Enter password", text: "Provide the document password you are authorized to use." },
      { name: "Download unlocked PDF", text: "Download a copy without password restrictions." },
    ],
    ["Requires correct password", "For documents you own or may access", "Does not crack unknown passwords", "HTTPS/TLS transfer", "Published file-retention window"]
  ),
  "protect-pdf": aeo(
    "OnlyMyPDF Protect PDF adds password encryption to a PDF so only people with the password can open it.",
    "Protect PDF applies user-password encryption to restrict opening, sharing, or printing of sensitive documents.",
    [
      { name: "Upload PDF", text: "Upload the PDF you want to protect." },
      { name: "Set password", text: "Choose a strong password and confirm it." },
      { name: "Download protected PDF", text: "Download the encrypted PDF; recipients need the password to open it." },
    ],
    ["Password encryption", "Restrict unauthorized access", "Free online tool", "SSL encrypted upload", "Files deleted after retention"]
  ),
  "edit-pdf": aeo(
    "OnlyMyPDF Edit PDF adds text and images on top of any PDF page in a visual browser editor, then exports the updated file.",
    "Edit PDF is an online editor for annotating PDFs — add text blocks, insert images, drag to position, and download without desktop software.",
    [
      { name: "Upload PDF", text: "Upload the PDF you want to edit." },
      { name: "Add content", text: "Place text and images on any page using the visual editor." },
      { name: "Export PDF", text: "Download the edited PDF with your additions layered on top." },
    ],
    ["Add text and images", "Drag-to-position elements", "Original pages are not raster-compressed", "Browser-based editor", "Published file-retention window"]
  ),
};

export function getToolAeo(slug: string): ToolAeo | undefined {
  return TOOL_AEO[slug];
}

export function getAllToolAeoEntries(): { slug: string; aeo: ToolAeo }[] {
  return Object.entries(TOOL_AEO).map(([slug, aeo]) => ({ slug, aeo }));
}
