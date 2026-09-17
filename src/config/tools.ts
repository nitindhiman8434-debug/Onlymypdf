import type { ToolSEO } from "@/types";
import { planFileSizeFaqLine } from "@/lib/billing/billing-copy";

export { planFileSizeFaqLine };

export const TOOL_SEO: Record<string, ToolSEO> = {
  "merge-pdf": {
    title: "Merge PDF — Combine Multiple PDFs into One | OnlyMyPDF",
    metaDescription:
      "Merge multiple PDF files into a single document online for free. Drag and drop to reorder pages. No signup required. Fast, secure, and easy to use.",
    h1: "Merge PDF Files Online — Free & Fast",
    seoContent:
      "Combine two or more PDF files into a single document in seconds. OnlyMyPDF's Merge PDF tool lets you drag and drop multiple files, reorder pages as needed, and download a perfectly combined PDF — all from your browser. No software to install, no registration required.",
    faqs: [
      {
        question: "How do I merge PDF files?",
        answer:
          "Simply upload your PDF files using the upload area or drag and drop them. Reorder the files if needed by dragging them into the desired sequence, then click 'Merge' to combine them into one PDF.",
      },
      {
        question: "Is there a limit on how many PDFs I can merge?",
        answer:
          "Free users can merge up to 20 PDF files at once, while Pro users can combine up to 50 files in a single operation.",
      },
      {
        question: "Will merging reduce the quality of my PDFs?",
        answer:
          "No, our merge tool combines your PDFs without any re-compression or quality loss. The output file retains the exact same quality as the original documents.",
      },
      {
        question: "Is my data safe when merging PDFs online?",
        answer:
          "Files are transferred over HTTPS/TLS and scheduled for deletion within 2 hours (Free) or 24 hours (Pro).",
      },
    ],
  },

  "split-pdf": {
    title: "Split PDF — Extract Pages from PDF Online | OnlyMyPDF",
    metaDescription:
      "Split PDF files into individual pages or extract specific page ranges online for free. Fast, secure, and no signup required.",
    h1: "Split PDF — Extract Pages Instantly",
    seoContent:
      "Need to extract specific pages from a large PDF? OnlyMyPDF's Split PDF tool makes it easy. Upload your PDF, select the pages or page ranges you want, and download them as separate files. Perfect for extracting chapters from an e-book, pulling specific pages from a report, or breaking down large documents into manageable sections. Works entirely in your browser with no software needed.",
    faqs: [
      {
        question: "How do I split a PDF into separate pages?",
        answer:
          "Upload your PDF file, then choose whether to split all pages into individual files or specify custom page ranges (e.g., 1-3, 5, 8-10). Click 'Split' and download your files.",
      },
      {
        question: "Can I extract just a few pages from a PDF?",
        answer:
          "Yes, you can specify exactly which pages to extract using page ranges. For example, entering '2-5, 8' will extract pages 2 through 5 and page 8.",
      },
      {
        question: "Does splitting a PDF affect the original file?",
        answer:
          "No, the original PDF remains unchanged. Our tool creates new files from the pages you select without modifying the source document.",
      },
    ],
  },

  "compress-pdf": {
    title: "Compress PDF — Reduce PDF File Size Online | OnlyMyPDF",
    metaDescription:
      "Compress PDF files with lossless Basic mode or smaller Strong mode. Strong mode can flatten searchable text and interactive content.",
    h1: "Compress PDF — Reduce File Size Instantly",
    seoContent:
      "Basic compression applies lossless structural optimization and returns the original file when savings would be insignificant. Strong compression rasterizes pages for larger reductions, which can flatten searchable text, links, forms, and bookmarks. The result screen reports the actual method and size change.",
    faqs: [
      {
        question: "How much can I reduce my PDF file size?",
        answer:
          "Savings depend on the PDF. Basic mode may return the original when no meaningful lossless saving is possible. Strong mode usually helps most on image-heavy files, and the exact before/after size is shown.",
      },
      {
        question: "Will compression affect the quality of my PDF?",
        answer:
          "Basic mode is lossless. Strong mode rasterizes pages, so it can reduce image quality and flatten searchable text, links, forms, and bookmarks.",
      },
      {
        question: "What is the maximum file size I can compress?",
        answer:
          `${planFileSizeFaqLine()} Compress PDFs within your plan limit.`,
      },
    ],
  },

  "pdf-to-word": {
    title: "PDF to Word — Convert PDF to Editable DOCX Online | OnlyMyPDF",
    metaDescription:
      "Convert PDF files to editable Word documents (.docx) online for free. Real text, tables, headings, and bullet lists you can edit.",
    h1: "Convert PDF to Word — Free Online Converter",
    seoContent:
      "Transform your PDF documents into fully editable Word files (.docx). OnlyMyPDF extracts real text, headings, bullet lists, and tables — so you can edit content in Microsoft Word, Google Docs, or LibreOffice. Layout and formatting are preserved as closely as possible.",
    faqs: [
      {
        question: "How accurate is the PDF to Word conversion?",
        answer:
          "We use a multi-engine pipeline for professional-grade results: ConvertAPI (when configured), Microsoft Word or LibreOffice on the server, then pdf2docx (Python). Complex layouts like tax invoices keep tables, fonts, and images. The basic text-only fallback is never used when a quality engine is available.",
      },
      {
        question: "Can I convert a scanned PDF to Word?",
        answer:
          "Scanned PDFs (image-only pages) need OCR first. Use our PDF Scanner tool to create a searchable PDF, then convert to Word for editable text.",
      },
      {
        question: "What Word format does the converter output?",
        answer:
          "The converter outputs .docx format (Microsoft Word 2007 and later), which is compatible with Microsoft Word, Google Docs, LibreOffice, and most modern word processors.",
      },
      {
        question: "Is there a page limit for conversion?",
        answer:
          "There is no specific page limit. " + planFileSizeFaqLine(),
      },
    ],
  },

  "word-to-pdf": {
    title: "Word to PDF — Convert DOCX to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert Word documents (.doc, .docx) to PDF online with layout-aware rendering. Fast and secure.",
    h1: "Convert Word to PDF — Free Online Tool",
    seoContent:
      "Convert Word documents to PDF using a server-side office rendering engine. Common fonts, images, tables, headers, and footers are retained when supported; complex layouts or unavailable fonts can render differently, so preview the result before sharing or printing.",
    faqs: [
      {
        question: "Will the formatting be preserved in the PDF?",
        answer:
          "The converter preserves common fonts, images, tables, margins, headers, and footers when supported. Complex layouts and unavailable fonts can vary, so preview the output before use.",
      },
      {
        question: "Can I convert .doc files (older Word format)?",
        answer:
          "Yes, we support both .doc (Word 97-2003) and .docx (Word 2007+) formats for conversion to PDF.",
      },
      {
        question: "Is there a file size limit?",
        answer:
          `${planFileSizeFaqLine()} Convert PDFs within your plan limit.`,
      },
    ],
  },

  "jpg-to-pdf": {
    title: "JPG to PDF — Convert Images to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert JPG, PNG, and other images to PDF format online for free. Combine multiple images into one PDF. Fast and easy.",
    h1: "Convert Images to PDF — JPG, PNG & More",
    seoContent:
      "Convert your images to PDF format quickly and easily. OnlyMyPDF's Image to PDF converter supports JPG, JPEG, PNG, WebP, and GIF formats. Upload multiple images and combine them into a single PDF document — perfect for creating photo albums, digitizing documents, or preparing image portfolios. Drag and drop to reorder images before conversion. Each image is placed on its own page with optimal sizing.",
    faqs: [
      {
        question: "What image formats can I convert to PDF?",
        answer:
          "We support JPG/JPEG, PNG, WebP, and GIF image formats for conversion to PDF.",
      },
      {
        question: "Can I combine multiple images into one PDF?",
        answer:
          "Yes, you can upload up to 20 images (50 for Pro users) and combine them into a single PDF. Drag and drop to reorder the images before converting.",
      },
      {
        question: "What will be the quality of images in the PDF?",
        answer:
          "Images are embedded in the PDF at their original resolution and quality. There is no compression applied to the images during conversion.",
      },
      {
        question: "Can I set the page size for the PDF?",
        answer:
          "The default page size is A4 with images automatically scaled to fit. Images maintain their aspect ratio and are centered on each page.",
      },
    ],
  },

  "html-to-pdf": {
    title: "HTML to PDF — Convert HTML Pages to PDF Online | OnlyMyPDF",
    metaDescription:
      "Render HTML files to PDF with Chromium. Supports embedded CSS, images, SVG, and complex layouts while blocking scripts and external requests for safety.",
    h1: "Convert HTML to PDF — Chromium Rendering",
    seoContent:
      "Render HTML files to PDF with a Chromium print engine. Embedded CSS, Flexbox, Grid, data images, SVG, media queries, and print styles are supported. For safety, JavaScript and external network or file requests are blocked, so embed required fonts and images. Choose A4, Letter, or CSS page size, orientation, and margins.",
    faqs: [
      {
        question: "What file types can I convert?",
        answer:
          "We support HTML (.html, .htm), XHTML (.xhtml), MHTML (.mhtml), and SVG (.svg) files for conversion to PDF.",
      },
      {
        question: "Will CSS styles be preserved in the PDF?",
        answer:
          "The Chromium print engine supports embedded CSS including Flexbox, Grid, media queries, and print styles. JavaScript is disabled and external resources are blocked, so embed required fonts and images for consistent output.",
      },
      {
        question: "Can I customize the PDF page size?",
        answer:
          "Yes, you can choose between A4, US Letter, or Auto (which uses the HTML page's own CSS page size). You can also set orientation and margin preferences.",
      },
      {
        question: "Are external resources (images, fonts) included?",
        answer:
          "Inline images (base64) and embedded resources are fully supported. External URLs referenced in the HTML may not load depending on network access. For best results, embed all resources inline.",
      },
    ],
  },

  "txt-to-pdf": {
    title: "TXT to PDF — Convert Text Files to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert TXT and other text files to professionally formatted PDF documents online for free. Choose fonts, sizes, and page layout. Fast and accurate.",
    h1: "Convert TXT to PDF — Professional Formatting",
    seoContent:
      "Convert any text file to a cleanly formatted PDF document with OnlyMyPDF's TXT to PDF converter. Supports TXT, LOG, CSV, MD, JSON, XML, YAML, INI, and other plain-text formats. Choose your preferred font (Helvetica, Courier, or Times), font size (9pt–16pt), page size (A4 or Letter), orientation, and margins. The converter intelligently wraps long lines, preserves blank lines and paragraph breaks, and produces a professional PDF that matches the original text structure. Perfect for converting code files, log files, configuration files, and plain text documents to shareable PDF format.",
    faqs: [
      {
        question: "What file types can I convert?",
        answer:
          "We support TXT, TEXT, LOG, CSV, MD (Markdown), JSON, XML, YAML, YML, INI, CFG, CONF, and ENV files — essentially any plain-text file.",
      },
      {
        question: "Can I choose the font and size?",
        answer:
          "Yes! Choose between Helvetica (clean sans-serif), Courier (monospace — great for code), or Times (classic serif). Font sizes range from 9pt to 16pt.",
      },
      {
        question: "Will long lines be cut off?",
        answer:
          "No. Long lines are automatically word-wrapped to fit within the page margins. No text content is ever lost or cut off.",
      },
      {
        question: "Is there a file size limit?",
        answer:
          `${planFileSizeFaqLine()} Convert text files within your plan limit.`,
      },
    ],
  },


  "sign-pdf": {
    title: "Sign PDF — Add Digital Signature to PDF Online | OnlyMyPDF",
    metaDescription:
      "Add your signature to PDF documents online. Draw, type, or upload your signature. Secure and legally acceptable digital signatures.",
    h1: "Sign PDF Documents Online — Quick & Secure",
    seoContent:
      "Sign your PDF documents digitally with OnlyMyPDF. Create your signature by drawing with your mouse or touchscreen, typing your name in a signature font, or uploading an image of your handwritten signature. Place your signature anywhere on the document, resize it as needed, and download the signed PDF. Perfect for contracts, agreements, forms, and official documents. Our digital signatures are secure and widely accepted.",
    faqs: [
      {
        question: "How can I create my signature?",
        answer:
          "You can create your signature in three ways: draw it using your mouse or touchscreen, type your name and choose a signature style font, or upload an image of your handwritten signature.",
      },
      {
        question: "Are digital signatures legally valid?",
        answer:
          "Digital signatures created with OnlyMyPDF are widely accepted for most business documents. For legally binding documents requiring certified digital signatures, you may need a certificate-based signature solution.",
      },
      {
        question: "Is the Sign PDF tool free?",
        answer:
          "Sign PDF is a Pro feature that requires a Pro subscription for full access.",
      },
      {
        question: "Can I sign multiple pages?",
        answer:
          "Yes, you can place your signature on any page of the document and add multiple signatures or initials as needed.",
      },
    ],
  },

  "ai-pdf-summarizer": {
    title: "AI PDF Summarizer — Get Instant PDF Summary | OnlyMyPDF",
    metaDescription:
      "Use AI to summarize PDF text and get key points, action items, and important dates. Signed-in Free users get 1 summary per day; Pro users get unlimited summaries.",
    h1: "AI PDF Summarizer — Instant Summaries & Insights",
    seoContent:
      "Let AI read extracted text from your PDF and provide a structured summary with key points, main ideas, important dates, and action items. It works best on text-heavy documents; scanned or image-heavy files may require OCR. A login is required. Signed-in Free users get 1 summary per day and Pro users get unlimited summaries, subject to service availability.",
    faqs: [
      {
        question: "How does the AI PDF Summarizer work?",
        answer:
          "Our AI reads the text content of your PDF and uses advanced language models to identify key points, main arguments, and important details. It then generates a structured summary with bullet points and main themes.",
      },
      {
        question: "What types of documents work best?",
        answer:
          "The AI summarizer works best with text-heavy documents like research papers, reports, articles, and legal documents. It may not produce optimal results for image-heavy PDFs or scanned documents.",
      },
      {
        question: "Is my document content kept private?",
        answer:
          "Yes, your document content is processed securely and is not stored after summarization. We do not use your documents to train AI models.",
      },
      {
        question: "Is this tool free to use?",
        answer:
          "A login account is required. Signed-in Free users get 1 AI summary per day; Pro users get unlimited AI summaries, subject to service availability.",
      },
      {
        question: "How long does summarization take?",
        answer:
          "Most documents are summarized within 10-30 seconds, depending on the length and complexity of the PDF.",
      },
    ],
  },

  "pdf-scanner": {
    title: "PDF Scanner — Scan Documents to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert scanned images and photos of documents into clean, professional PDFs. Enhance contrast and readability automatically.",
    h1: "PDF Scanner — Turn Photos into Clean PDFs",
    seoContent:
      "Transform photos of documents, receipts, whiteboards, and notes into clean, professional-looking PDFs. OnlyMyPDF's PDF Scanner applies automatic image enhancement including contrast adjustment, perspective correction, and background cleanup to make your scanned documents look crisp and readable. Upload photos from your phone or computer and get a clean PDF in seconds. Perfect for digitizing paper documents on the go.",
    faqs: [
      {
        question: "What types of images can I scan to PDF?",
        answer:
          "You can upload photos or scans of documents, receipts, business cards, whiteboards, notes, or any physical document in JPG, PNG, or WebP format.",
      },
      {
        question: "Does the scanner enhance image quality?",
        answer:
          "Yes, our scanner automatically adjusts contrast, brightness, and sharpness to make your scanned documents more readable and professional-looking.",
      },
      {
        question: "Can I scan multiple pages into one PDF?",
        answer:
          "Yes, upload up to 10 images (more for Pro users) and combine them into a single multi-page PDF document.",
      },
    ],
  },

  "unlock-pdf": {
    title: "Unlock PDF — Remove Password from PDF Online | OnlyMyPDF",
    metaDescription:
      "Remove password protection from your PDF files online. You must know the password. Free, fast, and secure.",
    h1: "Unlock PDF — Remove Password Protection",
    seoContent:
      "Remove an open password from a PDF you own or are authorized to access. You must provide the correct password. Uploads use HTTPS/TLS and follow the published file-retention window.",
    faqs: [
      {
        question: "Can I unlock a PDF without the password?",
        answer:
          "No, you must know and provide the correct password to unlock a protected PDF. Our tool removes the password requirement from the file once you authenticate with the correct password.",
      },
      {
        question: "What types of PDF protection can be removed?",
        answer:
          "Our tool can remove user passwords (required to open the PDF) and owner passwords (that restrict printing, editing, and copying) when you provide the correct password.",
      },
      {
        question: "Is it legal to unlock a PDF?",
        answer:
          "It is legal to remove password protection from PDFs that you own or have authorization to access. Do not use this tool to bypass protection on documents you don't have permission to access.",
      },
    ],
  },

  "protect-pdf": {
    title: "Protect PDF — Add Password to PDF Online | OnlyMyPDF",
    metaDescription:
      "Add password protection to your PDF files online. Set open and permission passwords. Secure your sensitive documents for free.",
    h1: "Protect PDF — Add Password & Encrypt",
    seoContent:
      "Add an AES-256 open password to a PDF so recipients must enter it before viewing the document. Use a unique, strong password and share it through a separate channel.",
    faqs: [
      {
        question: "What type of encryption is used?",
        answer:
          "The generated PDF uses AES-256 password encryption.",
      },
      {
        question: "Can I set different permissions?",
        answer:
          "This version sets an open password. Separate printing, editing, copying, and annotation permission controls are not currently exposed.",
      },
      {
        question: "Can I remove the password later?",
        answer:
          "Yes, use our Unlock PDF tool to remove the password from a protected PDF. You'll need to provide the correct password to remove the protection.",
      },
      {
        question: "Is my password stored anywhere?",
        answer:
          "No, we never store your passwords. The password is applied directly to the PDF during processing and is not retained on our servers.",
      },
    ],
  },

  "pdf-to-excel": {
    title: "PDF to Excel — Convert PDF to XLSX Spreadsheet Online | OnlyMyPDF",
    metaDescription:
      "Convert PDF files to Excel spreadsheets (.xlsx) online for free. Extract text and tables from PDF into editable Excel format.",
    h1: "Convert PDF to Excel — Free Online Tool",
    seoContent:
      "Extract text and tabular data from your PDF documents into editable Excel spreadsheets (.xlsx). OnlyMyPDF's PDF to Excel converter parses text-based PDFs and organizes content into rows and columns. Best for reports, invoices, and data tables. Scanned PDFs without selectable text may need OCR first.",
    faqs: [
      {
        question: "Will tables be preserved in Excel?",
        answer:
          "Text-based PDFs with clear column structure convert well. Complex layouts or scanned documents may require manual cleanup after conversion.",
      },
      {
        question: "Does it work with scanned PDFs?",
        answer:
          "This tool extracts selectable text from PDFs. For scanned documents, use the PDF Scanner tool first or ensure your PDF has a text layer.",
      },
    ],
  },

  "excel-to-pdf": {
    title: "Excel to PDF — Convert XLSX to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert Excel spreadsheets (.xls, .xlsx) to PDF format online for free. Preserves worksheet data in a printable PDF.",
    h1: "Convert Excel to PDF — Free Online Converter",
    seoContent:
      "Convert your Excel spreadsheets to PDF documents ready for sharing and printing. OnlyMyPDF renders each worksheet as a formatted table in the PDF. Supports .xls and .xlsx files with multiple sheets.",
    faqs: [
      {
        question: "Are all worksheets included?",
        answer: "Yes, each worksheet in your Excel file is included as a separate section in the PDF.",
      },
      {
        question: "Will formulas be preserved?",
        answer: "The PDF shows calculated cell values, not formulas. Formatting is simplified for print-friendly output.",
      },
    ],
  },

  "pdf-to-ppt": {
    title: "PDF to PowerPoint — Convert PDF to PPTX Online | OnlyMyPDF",
    metaDescription:
      "Convert PDF files to PowerPoint presentations (.pptx) online. Each PDF page becomes a full-slide image; the page appearance is preserved but individual text, chart, link, and form elements are not editable.",
    h1: "Convert PDF to PowerPoint — Free Online Tool",
    seoContent:
      "Transform PDF pages into a PowerPoint presentation (.pptx). Each PDF page is rendered as a full slide image that preserves layout, fonts, and graphics — ideal for repurposing reports and invoices into presentations.",
    faqs: [
      {
        question: "Are images and layout preserved?",
        answer:
          "Yes. Each PDF page becomes one slide with the page rendered as a high-quality image, so charts, logos, and formatting stay intact.",
      },
      {
        question: "Can I edit the slides after conversion?",
        answer: "The .pptx file opens in PowerPoint and compatible apps, and slides can be reordered or annotated. The original page content is a flattened image, so individual text, charts, links, and form elements are not editable.",
      },
    ],
  },

  "ppt-to-pdf": {
    title: "PowerPoint to PDF — Convert PPTX to PDF Online | OnlyMyPDF",
    metaDescription:
      "Convert PowerPoint presentations (.ppt, .pptx) to PDF format online for free. Share slides as a single PDF document.",
    h1: "Convert PowerPoint to PDF — Free Online Converter",
    seoContent:
      "Convert PowerPoint presentations to PDF for easy sharing and printing. OnlyMyPDF extracts slide content and renders it as a clean PDF document. Supports .ppt and .pptx formats.",
    faqs: [
      {
        question: "Will slide designs be preserved exactly?",
        answer:
          "The converter extracts text content from slides. For pixel-perfect slide rendering, export directly from PowerPoint if available.",
      },
      {
        question: "How many slides can I convert?",
        answer: `There is no slide count limit. ${planFileSizeFaqLine()}`,
      },
    ],
  },

  "add-watermark": {
    title: "Add Watermark to PDF — Text & Image Watermarks Online | OnlyMyPDF",
    metaDescription:
      "Add text or image watermarks to PDF files online for free. Customize opacity, rotation, and font size.",
    h1: "Add Watermark to PDF — Free Online Tool",
    seoContent:
      "Protect and brand your PDF documents with custom watermarks. Add text watermarks like CONFIDENTIAL or DRAFT, or upload an image logo. Adjust opacity, rotation angle, and font size. The watermark is applied to every page of your PDF.",
    faqs: [
      {
        question: "Can I use my company logo as a watermark?",
        answer: "Yes, upload a PNG or JPG image and it will be placed as a semi-transparent watermark on all pages.",
      },
      {
        question: "Can I watermark only specific pages?",
        answer: "The current tool applies watermarks to all pages. Page-specific watermarks may be added in a future update.",
      },
    ],
  },
  "rotate-pdf": {
    title: "Rotate PDF — Rotate Pages Online Free | OnlyMyPDF",
    metaDescription:
      "Rotate PDF pages online for free. Rotate individual pages or all pages at once — 90°, 180°, or 270°. Add pages from other PDFs. No signup required.",
    h1: "Rotate PDF Pages Online — Free & Visual",
    seoContent:
      "Rotate PDF pages with a visual drag-and-drop workspace. OnlyMyPDF's Rotate PDF tool lets you preview every page, rotate individual pages or select multiple pages to rotate at once. Add blank pages or insert pages from other PDFs between existing pages. Download the result instantly — no signup, no watermarks, no quality loss.",
    faqs: [
      {
        question: "How do I rotate a single page in a PDF?",
        answer:
          "Upload your PDF, hover over the page you want to rotate, and click the rotate button. You can rotate left (counter-clockwise) or right (clockwise) by 90° each click.",
      },
      {
        question: "Can I rotate multiple pages at once?",
        answer:
          "Yes! Select multiple pages using the checkboxes, then use the bulk rotate buttons in the toolbar to rotate all selected pages simultaneously.",
      },
      {
        question: "Does rotating affect PDF quality?",
        answer:
          "Rotation changes page orientation without rasterizing the page, so existing text and images are copied without image recompression.",
      },
      {
        question: "Can I add pages from another PDF?",
        answer:
          "Yes! Click the + button between any two pages to add documents from another PDF or insert a blank page.",
      },
    ],
  },
  "delete-pdf": {
    title: "Delete PDF Pages — Remove Pages Online Free | OnlyMyPDF",
    metaDescription:
      "Delete pages from your PDF online for free. Remove individual pages or multiple pages at once. Add pages from other PDFs. No signup required.",
    h1: "Delete PDF Pages Online — Free & Visual",
    seoContent:
      "Remove unwanted pages from your PDF with a visual workspace. OnlyMyPDF's Delete PDF Pages tool lets you preview every page, delete individual pages with one click, or select multiple pages to remove at once. You can also add blank pages or insert pages from other PDFs. Download the result instantly — no signup, no watermarks, no quality loss.",
    faqs: [
      {
        question: "How do I delete a single page from a PDF?",
        answer:
          "Upload your PDF, hover over the page you want to remove, and click the red trash icon. The page is removed instantly from the preview.",
      },
      {
        question: "Can I delete multiple pages at once?",
        answer:
          "Yes! Select multiple pages using the checkboxes, then click the 'Delete selected' button in the toolbar to remove all selected pages simultaneously.",
      },
      {
        question: "Does deleting pages affect PDF quality?",
        answer:
          "The remaining pages are copied into the result without rasterizing their text or images.",
      },
      {
        question: "Can I add pages from another PDF?",
        answer:
          "Yes! Click the + button between any two pages to add documents from another PDF or insert a blank page.",
      },
    ],
  },
  "extract-pdf": {
    title: "Extract PDF Pages — Extract Pages Online Free | OnlyMyPDF",
    metaDescription:
      "Extract specific pages from your PDF online for free. Select the pages you need, click Finish, and download a new PDF with only those pages. No signup required.",
    h1: "Extract PDF Pages Online — Free & Visual",
    seoContent:
      "Extract pages from any PDF with a visual workspace. OnlyMyPDF's Extract Pages tool lets you preview every page, select the ones you need, and create a new PDF with just those pages. You can also add pages from other PDFs or insert blank pages. Download instantly — no signup, no watermarks, no quality loss.",
    faqs: [
      {
        question: "How do I extract specific pages from a PDF?",
        answer:
          "Upload your PDF, click the pages you want to extract (they highlight in blue), then click 'Finish' to download a new PDF containing only those pages.",
      },
      {
        question: "Can I extract non-consecutive pages?",
        answer:
          "Yes! Click any combination of pages — they don't need to be adjacent or in a specific order. The extracted PDF preserves page order.",
      },
      {
        question: "Does extracting pages affect quality?",
        answer:
          "Selected pages are copied into the result without rasterizing their text or images.",
      },
      {
        question: "Can I add pages from another PDF before extracting?",
        answer:
          "Yes! Click the + button between any two pages to add documents from another PDF or insert a blank page, then select from all available pages.",
      },
    ],
  },
  "edit-pdf": {
    title: "Edit PDF — Add Text & Images Online Free | OnlyMyPDF",
    metaDescription:
      "Edit PDF files online for free. Add text, insert images, and reposition elements in a visual editor. No signup required for basic edits.",
    h1: "Edit PDF Online — Add Text & Images Free",
    seoContent:
      "Edit your PDF documents directly in the browser with OnlyMyPDF's visual editor. Add text anywhere on any page, insert images, drag to reposition elements, and download the updated PDF — no desktop software required. Perfect for filling forms, annotating documents, or making quick corrections.",
    faqs: [
      {
        question: "What types of edits can I make to a PDF?",
        answer:
          "Add text anywhere on any page, insert images, drag to reposition, and export — all in a visual editor like professional PDF tools.",
      },
      {
        question: "Will editing affect the original PDF quality?",
        answer:
          "No. Additions are layered on top of your existing content without re-compressing the underlying document.",
      },
      {
        question: "Is there a page or file size limit?",
        answer:
          `${planFileSizeFaqLine()} Edit PDFs within your plan limit.`,
      },
    ],
  },
};

export function getToolSEO(slug: string): ToolSEO | undefined {
  return TOOL_SEO[slug];
}
