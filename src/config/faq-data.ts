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
          `Yes! OnlyMyPDF offers a generous free tier with 5 tool uses per day and ${FILE_SIZE_MARKETING.freeLabel.toLowerCase()}. For power users who need more, our Pro plan offers 100 daily uses, AI tools, priority processing, and more.`,
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
          "Navigate to the Merge PDF tool, upload multiple PDF files (drag and drop or click to browse), arrange them in your desired order, and click 'Merge'. Your combined PDF will be ready to download within seconds.",
      },
      {
        question: "What is the maximum file size I can upload?",
        answer: planFileSizeFaqLine(),
      },
      {
        question: "How accurate is PDF to Word conversion?",
        answer:
          "Our PDF to Word conversion preserves most formatting, text, images, and layout. However, complex documents with intricate formatting, custom fonts, or unusual layouts may not convert perfectly.",
      },
      {
        question: "What does the AI PDF Summarizer do?",
        answer:
          "The AI PDF Summarizer reads extracted PDF text and generates a concise summary with key points, action items, and important dates. Signed-in Free users get 1 summary per day; Pro users get unlimited summaries, subject to service availability.",
      },
      {
        question: "How does the PDF Scanner work?",
        answer:
          "The PDF Scanner uses your device's camera to capture documents and converts them into clean, high-quality PDF files with edge detection and perspective correction.",
      },
    ],
  },
  {
    name: "Privacy & Security",
    questions: [
      {
        question: "Are my files safe?",
        answer:
          "Files are transmitted over HTTPS/TLS. Temporary storage follows the published retention window, and optional third-party processing is disclosed before use.",
      },
      {
        question: "How long are files stored?",
        answer:
          "Files are scheduled for deletion within 2 hours for Free users and 24 hours for Pro users. You can also manually delete files before the retention period expires.",
      },
      {
        question: "Is my data encrypted?",
        answer:
          "Yes. All data in transit is protected with TLS/SSL encryption. Files stored on our servers use encryption at rest.",
      },
      {
        question: "Do you share my files with anyone?",
        answer:
          "We never sell your files. Optional conversions and AI summarization use named sub-processors listed in our Privacy Policy. We do not use your documents to train AI models.",
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
          `Upgrade from the Pricing page or Dashboard → Pricing. ${BILLING_COPY.checkoutModel} Pro features activate immediately after successful checkout.`,
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
          "OnlyMyPDF works on Chrome, Firefox, Edge, Safari, and Opera. We recommend using the latest version for the best experience.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "OnlyMyPDF is a responsive web application optimized for mobile browsers. We don't currently have a native mobile app.",
      },
      {
        question: "Can I use OnlyMyPDF offline?",
        answer:
          "No, OnlyMyPDF requires an internet connection as all file processing happens on our secure cloud servers.",
      },
    ],
  },
];

export function getAllFaqItems(): FaqItem[] {
  return FAQ_CATEGORIES.flatMap((category) => category.questions);
}
