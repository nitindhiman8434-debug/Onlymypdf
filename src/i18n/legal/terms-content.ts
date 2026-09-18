import { FILE_LIMITS, formatFileSizeMarketingLabel } from "@/config/constants";
import { LEGAL_CONTACT, LEGAL_POLICY_DATE, PUBLIC_RETENTION } from "@/config/legal";
import { BILLING_COPY } from "@/lib/billing/billing-copy";
import type { LegalDocument } from "./index";

const freeSizeLabel = formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB);
const proSizeLabel = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB);

export const termsLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Terms of service",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "1. Agreement and eligibility",
        paragraphs: [
          "By using OnlyMyPDF, you agree to these terms. Do not use the service if you do not agree.",
          "You must be able to enter a binding contract in your country. A parent or guardian must supervise use by a minor who cannot consent independently.",
        ],
      },
      {
        title: "2. What the service does",
        paragraphs: [
          "OnlyMyPDF provides browser and server-based tools to organize, convert, compress, edit, sign, protect, scan, and summarize documents.",
          "Available tools, providers, limits, and output quality can vary by file, plan, device, and deployment configuration.",
        ],
      },
      {
        title: "3. Review every output",
        bullets: [
          "Conversions can change layout, fonts, tables, images, reading order, formulas, or metadata. Review the result before relying on it.",
          "AI summaries can omit context or contain errors. Do not use them as legal, medical, financial, or professional advice.",
          "The Sign PDF tool places a visual signature. It is not a certificate-based digital signature unless the tool expressly says otherwise.",
        ],
      },
      {
        title: "4. Accounts and security",
        bullets: [
          "Provide accurate account information and protect your credentials and devices.",
          "You are responsible for activity under your account unless applicable law states otherwise.",
          "OnlyMyPDF may require identity verification for exports, account deletion, billing, or security changes.",
        ],
      },
      {
        title: "5. Your files and processing permission",
        paragraphs: [
          "You retain ownership of your files. You grant OnlyMyPDF and its disclosed processors a limited permission to receive, copy, convert, and return files only to provide the feature you request, secure the service, and meet legal obligations.",
          "You must have the right to upload and process every file. Do not submit files that violate privacy, intellectual property, confidentiality, or other rights.",
        ],
      },
      {
        title: "6. Limits and retention",
        bullets: [
          `Free plan: ${freeSizeLabel} and ${FILE_LIMITS.maxFreeUsesPerDay} tool uses per day under the default configuration.`,
          `Pro plan: ${proSizeLabel} and ${FILE_LIMITS.maxProUsesPerDay} tool uses per day under the default configuration.`,
          `Free files expire within ${FILE_LIMITS.fileRetentionHours} hours. Pro files expire within ${PUBLIC_RETENTION.proFileHours} hours. A tool may delete temporary data sooner.`,
          "The selected tool can impose a lower file-count, page-count, format, memory, or processing limit.",
        ],
      },
      {
        title: "7. Acceptable use",
        bullets: [
          "Do not upload illegal, malicious, exploitative, or unauthorized content.",
          "Do not bypass limits, probe another account, disrupt the service, or automate requests without written permission or an authorized API key.",
          "Do not use OnlyMyPDF to remove protection from a file unless you own it or have permission.",
        ],
      },
      {
        title: "8. Paid plans and checkout",
        bullets: [
          BILLING_COPY.checkoutModel,
          "The checkout page shows the price, billing period, taxes, and renewal status before payment. Prices displayed outside checkout are informational until confirmed at checkout.",
          "For auto-renewing plans, cancel from Dashboard before the next charge. Access continues through the paid period unless law or account enforcement requires otherwise.",
          "Refund requests follow the published Refund policy and any mandatory consumer rights.",
        ],
      },
      {
        title: "9. Suspension and service changes",
        paragraphs: [
          "OnlyMyPDF may restrict or suspend access to protect users, investigate abuse, comply with law, or prevent harm. We may change or discontinue a feature, but mandatory rights and paid entitlements remain subject to applicable law.",
        ],
      },
      {
        title: "10. Intellectual property",
        paragraphs: [
          "OnlyMyPDF branding, software, design, and site content remain the property of their respective owners. These terms do not transfer those rights to you.",
        ],
      },
      {
        title: "11. Warranty and liability limits",
        paragraphs: [
          "The service is provided as available. To the extent allowed by law, OnlyMyPDF disclaims implied warranties and is not liable for indirect, incidental, or consequential loss.",
          "Nothing in these terms excludes liability or consumer rights that applicable law does not allow us to exclude.",
        ],
      },
      {
        title: "12. Law, changes, and contact",
        paragraphs: [
          `These terms are governed by applicable Indian law, subject to mandatory rights in your country. ${LEGAL_CONTACT.operatorName} operates from ${LEGAL_CONTACT.operatorCountry}.`,
          "When terms change, the updated date appears on this page. We will provide additional notice when law requires it. Continued use after the effective date means the updated terms apply to later use.",
          `Send legal or terms questions to ${LEGAL_CONTACT.supportEmail}.`,
        ],
      },
    ],
  },
  hi: {
    pageTitle: "सेवा की शर्तें",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "1. सहमति और पात्रता",
        paragraphs: [
          "OnlyMyPDF उपयोग करके आप इन शर्तों से सहमत होते हैं। सहमत न होने पर सेवा उपयोग न करें।",
          "आप अपने देश में binding contract करने योग्य होने चाहिए। स्वतंत्र सहमति न दे सकने वाले minor का उपयोग parent या guardian की देखरेख में होना चाहिए।",
        ],
      },
      {
        title: "2. सेवा क्या करती है",
        paragraphs: [
          "OnlyMyPDF documents को organize, convert, compress, edit, sign, protect, scan और summarize करने के लिए browser और server-based tools देता है।",
          "Available tools, providers, limits और output quality file, plan, device और deployment configuration के अनुसार बदल सकते हैं।",
        ],
      },
      {
        title: "3. हर output जांचें",
        bullets: [
          "Conversion layout, fonts, tables, images, reading order, formulas या metadata बदल सकता है। भरोसा करने से पहले result जांचें।",
          "AI summary context छोड़ सकती है या गलत हो सकती है। इसे legal, medical, financial या professional advice न मानें।",
          "Sign PDF tool visual signature लगाता है। जब तक tool साफ न बताए, यह certificate-based digital signature नहीं है।",
        ],
      },
      {
        title: "4. खाते और सुरक्षा",
        bullets: [
          "सही account information दें और credentials तथा devices सुरक्षित रखें।",
          "लागू कानून के अलग कहने के अलावा account activity की जिम्मेदारी आपकी है।",
          "Export, account deletion, billing या security change के लिए OnlyMyPDF identity verification मांग सकता है।",
        ],
      },
      {
        title: "5. आपकी files और processing permission",
        paragraphs: [
          "Files का ownership आपका रहता है। मांगा हुआ feature देने, सेवा सुरक्षित रखने और कानूनी दायित्व पूरे करने के लिए आप OnlyMyPDF और disclosed processors को files receive, copy, convert और return करने की सीमित अनुमति देते हैं।",
          "हर file upload और process करने का अधिकार आपके पास होना चाहिए। Privacy, intellectual property, confidentiality या दूसरे अधिकार तोड़ने वाली file submit न करें।",
        ],
      },
      {
        title: "6. Limits और retention",
        bullets: [
          `Free plan: default configuration में ${freeSizeLabel} और प्रतिदिन ${FILE_LIMITS.maxFreeUsesPerDay} tool uses।`,
          `Pro plan: default configuration में ${proSizeLabel} और प्रतिदिन ${FILE_LIMITS.maxProUsesPerDay} tool uses।`,
          `Free files ${FILE_LIMITS.fileRetentionHours} घंटे में और Pro files ${PUBLIC_RETENTION.proFileHours} घंटे में expire होती हैं। कोई tool temporary data पहले मिटा सकता है।`,
          "Selected tool कम file-count, page-count, format, memory या processing limit लगा सकता है।",
        ],
      },
      {
        title: "7. स्वीकार्य उपयोग",
        bullets: [
          "Illegal, malicious, exploitative या unauthorized content upload न करें।",
          "Limits bypass, दूसरे account की जांच, service disrupt या written permission या authorized API key के बिना automated requests न करें।",
          "File आपकी हो या permission हो तभी protection remove करने के लिए OnlyMyPDF उपयोग करें।",
        ],
      },
      {
        title: "8. Paid plans और checkout",
        bullets: [
          "Payment से पहले checkout बताता है कि purchase auto-renew होगा या one-time। Live checkout उपलब्ध होने पर Razorpay payment process करता है।",
          "Payment से पहले checkout price, billing period, tax और renewal status दिखाता है। Checkout से बाहर दिखा price confirmation तक informational है।",
          "Auto-renew plan को अगली charge से पहले Dashboard में cancel करें। कानून या account enforcement के अलावा paid period तक access रहता है।",
          "Refund request published Refund policy और mandatory consumer rights के अनुसार चलता है।",
        ],
      },
      {
        title: "9. Suspension और service changes",
        paragraphs: [
          "Users की सुरक्षा, abuse investigation, कानून पालन या harm रोकने के लिए OnlyMyPDF access restrict या suspend कर सकता है। Feature बदल या बंद हो सकता है, लेकिन mandatory rights और paid entitlement पर लागू कानून लागू रहेगा।",
        ],
      },
      {
        title: "10. Intellectual property",
        paragraphs: [
          "OnlyMyPDF branding, software, design और site content अपने respective owners की property हैं। ये शर्तें वे rights आपको transfer नहीं करतीं।",
        ],
      },
      {
        title: "11. Warranty और liability limits",
        paragraphs: [
          "Service available basis पर दी जाती है। कानून की सीमा तक OnlyMyPDF implied warranties अस्वीकार करता है और indirect, incidental या consequential loss के लिए liable नहीं है।",
          "इन terms से ऐसी liability या consumer right exclude नहीं होती जिसे कानून exclude करने की अनुमति नहीं देता।",
        ],
      },
      {
        title: "12. कानून, बदलाव और संपर्क",
        paragraphs: [
          `ये terms लागू Indian law से governed हैं और आपके देश के mandatory rights लागू रहेंगे। ${LEGAL_CONTACT.operatorName}, ${LEGAL_CONTACT.operatorCountry} से operate करता है।`,
          "Terms बदलने पर updated date इस page पर दिखेगी। कानून के अनुसार अतिरिक्त notice दिया जाएगा। Effective date के बाद use जारी रखने पर updated terms बाद के use पर लागू होंगी।",
          `Legal या terms प्रश्न ${LEGAL_CONTACT.supportEmail} पर भेजें।`,
        ],
      },
    ],
  },
};
