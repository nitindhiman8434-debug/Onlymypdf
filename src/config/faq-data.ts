import { FILE_SIZE_MARKETING } from "@/config/constants";
import { BILLING_COPY, planFileSizeFaqLine } from "@/lib/billing/billing-copy";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  name: string;
  questions: FaqItem[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    name: "General",
    questions: [
      {
        question: "What is OnlyMyPDF?",
        answer:
          "OnlyMyPDF is a free online PDF toolkit that lets you merge, split, compress, convert, edit, sign, protect, unlock, scan, and summarize PDF documents. It's designed to be fast, secure, and easy to use — no desktop software required.",
      },
      {
        question: "Is OnlyMyPDF free to use?",
        answer:
          `Free includes 5 tool uses per day and ${FILE_SIZE_MARKETING.freeLabel.toLowerCase()}. Pro is configured for 100 daily uses. Tool-specific limits and feature availability also apply; paid access depends on live checkout being available.`,
      },
      {
        question: "Do I need to create an account?",
        answer:
          "No, you can use basic PDF tools as a guest without creating an account. However, creating a free account lets you track your file history, manage downloads, and upgrade to Pro for additional features.",
      },
      {
        question: "What file formats are supported?",
        answer:
          "OnlyMyPDF primarily works with PDF files. Depending on the tool, we also support DOCX, DOC (Word documents), JPG, JPEG, and PNG (images). Each tool page specifies its accepted file formats.",
      },
    ],
  },
  {
    name: "Tools",
    questions: [
      {
        question: "How do I merge PDF files?",
        answer:
          "Open Merge PDF, upload PDF files, arrange them in the desired order, and click Merge. Download when processing finishes and review the result. Processing time depends on your files and service load.",
      },
      {
        question: "What is the maximum file size I can upload?",
        answer: planFileSizeFaqLine(),
      },
      {
        question: "How accurate is PDF to Word conversion?",
        answer:
          "Results depend on the source. The Benchmarks page reports controlled tests for selectable text, English OCR and ruled tables, with their limitations. Complex layouts, fonts and scans can change; review every converted document.",
      },
      {
        question: "What does the AI PDF Summarizer do?",
        answer:
          "The AI PDF Summarizer summarizes up to 100,000 characters of extracted text. Long documents may be truncated, and the result can omit or misstate information. Signed-in Free users get 1 summary per day; Pro has no separate daily summary allowance limit, subject to rate limits and service availability. Review the summary against your source.",
      },
      {
        question: "How does the PDF Scanner work?",
        answer:
          "Capture or upload up to 10 JPG, PNG or WebP images and choose Original, Black & White or Enhanced. Each image is placed on an A4 portrait PDF page. Crop or straighten images before uploading; automatic edge detection, perspective correction and OCR are not included. Review the downloaded pages.",
      },
    ],
  },
  {
    name: "Privacy & Security",
    questions: [
      {
        question: "Are my files safe?",
        answer:
          "Public deployment requires HTTPS/TLS and private storage configuration. The Privacy and Trust pages explain supported controls, optional processors and remaining deployment checks. No service can guarantee absolute security.",
      },
      {
        question: "How long are files stored?",
        answer:
          "Stored account files have a configured expiry of 2 hours on Free and 24 hours on Pro. Temporary previews and conversion jobs can expire sooner. Expiry restricts access; physical deletion happens during cleanup and can be delayed by failures. You can delete account files from Dashboard.",
      },
      {
        question: "Is my data encrypted?",
        answer:
          "HTTPS/TLS protects transfers when using an HTTPS deployment; the local preview uses loopback HTTP. Encryption of stored files depends on the configured storage and host. Current local checks do not establish encryption at rest for every temporary file.",
      },
      {
        question: "Do you share my files with anyone?",
        answer:
          "We do not sell uploaded files. Cloud storage, optional conversion services and AI summarization can send data to the processors described in the Privacy Policy when enabled. Review the applicable provider's data-use terms before submitting sensitive content.",
      },
    ],
  },
  {
    name: "Account & Billing",
    questions: [
      {
        question: "What is included in the Pro plan?",
        answer: BILLING_COPY.proIncludes,
      },
      {
        question: "How do I upgrade to Pro?",
        answer:
          `When live checkout is available, upgrade from Pricing or Dashboard → Pricing. ${BILLING_COPY.checkoutModel} Access is updated after payment is verified.`,
      },
      {
        question: "What payment methods are accepted?",
        answer: BILLING_COPY.paymentMethods,
      },
      {
        question: "Can I cancel auto-renew?",
        answer: BILLING_COPY.cancelAutoRenew,
      },
      {
        question: "Do you offer refunds?",
        answer: BILLING_COPY.refundSummary,
      },
    ],
  },
  {
    name: "Technical",
    questions: [
      {
        question: "Why did my PDF conversion fail?",
        answer:
          "Conversions can fail due to corrupted PDFs, password protection, files exceeding size limits, or complex formatting. Try Unlock PDF first or contact support.",
      },
      {
        question: "What browsers are supported?",
        answer:
          "Use a current browser such as Chrome, Firefox, Edge or Safari. Camera, file-picker and download behavior depend on the browser and device; review compatibility for the tool you use.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "OnlyMyPDF is a responsive web application optimized for mobile browsers. We don't currently have a native mobile app.",
      },
      {
        question: "Can I use OnlyMyPDF offline?",
        answer:
          "The public website requires a connection to its processing services. The development preview can run supported conversions locally when its dependencies are installed; cloud features such as AI summaries require their configured services.",
      },
    ],
  },
];

export function getAllFaqItems(): FaqItem[] {
  return FAQ_CATEGORIES.flatMap((category) => category.questions);
}
