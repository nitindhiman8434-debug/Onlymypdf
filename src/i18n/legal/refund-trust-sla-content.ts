import { FILE_LIMITS } from "@/config/constants";
import { LEGAL_CONTACT, LEGAL_POLICY_DATE, PUBLIC_RETENTION } from "@/config/legal";
import type { LegalDocument } from "./index";

export const refundLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Refund policy",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "When this policy applies",
        paragraphs: [
          "This policy applies to a completed OnlyMyPDF purchase. It does not apply when live checkout is unavailable or no charge occurred.",
          "Mandatory consumer rights in your country remain unaffected.",
        ],
      },
      {
        title: "Request a review",
        bullets: [
          `Email ${LEGAL_CONTACT.supportEmail} from the address linked to your account.`,
          "Include the payment date, amount, payment identifier, plan, and reason for the request. Do not send full card or bank credentials.",
          "OnlyMyPDF reviews duplicate charges, a paid feature that remained unavailable after support was contacted, and accidental renewal reports. A request does not guarantee approval.",
        ],
      },
      {
        title: "Review factors",
        bullets: [
          "How soon you reported the issue after the charge.",
          "Whether the paid feature was used and whether a technical failure can be verified.",
          "Whether the request involves fraud, abuse, chargeback misuse, or a terms violation.",
          "Any refund or cancellation right required by applicable law.",
        ],
      },
      {
        title: "Approved refunds",
        paragraphs: [
          "Approved refunds return through the original payment channel unless law requires another method. Razorpay and your bank control the time needed for the credit to appear.",
          "Cancelling an auto-renewing plan stops a future renewal. It does not automatically refund the current paid period.",
        ],
      },
      {
        title: "Enterprise and custom contracts",
        paragraphs: [
          "A signed enterprise or custom agreement can replace this policy for charges covered by that agreement.",
        ],
      },
    ],
  },
  hi: {
    pageTitle: "रिफंड नीति",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "यह policy कब लागू होती है",
        paragraphs: [
          "यह policy completed OnlyMyPDF purchase पर लागू होती है। Live checkout unavailable होने या charge न लगने पर यह लागू नहीं होती।",
          "आपके देश के mandatory consumer rights प्रभावित नहीं होते।",
        ],
      },
      {
        title: "Review request भेजें",
        bullets: [
          `Account से जुड़े email से ${LEGAL_CONTACT.supportEmail} पर लिखें।`,
          "Payment date, amount, payment ID, plan और request का कारण दें। पूरा card या bank credential न भेजें।",
          "Duplicate charge, support contact के बाद भी unavailable paid feature और accidental renewal report की review होती है। Request approval की guarantee नहीं है।",
        ],
      },
      {
        title: "Review के factors",
        bullets: [
          "Charge के बाद issue कितनी जल्दी report किया।",
          "Paid feature उपयोग हुआ या नहीं और technical failure verify हो सकता है या नहीं।",
          "Request fraud, abuse, chargeback misuse या terms violation से जुड़ी है या नहीं।",
          "लागू कानून से मिलने वाला refund या cancellation right।",
        ],
      },
      {
        title: "Approved refund",
        paragraphs: [
          "Approved refund original payment channel से वापस जाता है, जब तक कानून दूसरी method न मांगे। Credit दिखने का समय Razorpay और bank नियंत्रित करते हैं।",
          "Auto-renew plan cancel करने से future renewal रुकता है। Current paid period का refund automatic नहीं होता।",
        ],
      },
      {
        title: "Enterprise और custom contracts",
        paragraphs: [
          "Signed enterprise या custom agreement उसके covered charges के लिए इस policy को replace कर सकता है।",
        ],
      },
    ],
  },
};

export const trustLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Trust center",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "Verified technical controls",
        bullets: [
          "Transport Layer Security (TLS) protects browser and service traffic in transit.",
          "Supported files use private Supabase or Cloudflare R2 object storage. Temporary upload grants expire after 15 minutes, and download links are time-limited.",
          "Rate limits, origin checks, signed webhooks, multi-factor authentication, step-up checks, and admin audit records protect sensitive actions.",
          "Error monitoring removes configured sensitive headers and common personal fields before an event is sent when Sentry is enabled.",
        ],
      },
      {
        title: "Retention controls",
        bullets: [
          `Free files expire within ${FILE_LIMITS.fileRetentionHours} hours and Pro files within ${PUBLIC_RETENTION.proFileHours} hours.`,
          "The cleanup task runs hourly and retries expired objects that remain after a failed attempt.",
          "Account deletion requires recent identity verification and removes account-linked files and product history. Short-lived staging expires through normal cleanup, and legally required billing records remain in anonymized form.",
        ],
      },
      {
        title: "Provider transparency",
        bullets: [
          "Supabase, Cloudflare R2, Upstash, and Railway support core account, storage, queue, and worker functions.",
          "Google Gemini, Razorpay, Resend, ConvertAPI, and Sentry receive data only when their feature is enabled and used.",
          "The Privacy policy explains the data sent to each provider and the applicable retention limits.",
        ],
      },
      {
        title: "Accuracy and signature limits",
        bullets: [
          "OnlyMyPDF does not promise perfect conversion for every document. Complex fonts, scans, tables, formulas, and layouts can change.",
          "AI summaries can be incomplete or wrong and must be reviewed.",
          "The Sign PDF tool creates a visual signature, not a certificate-based digital signature.",
        ],
      },
      {
        title: "Compliance status",
        bullets: [
          "OnlyMyPDF does not currently claim SOC 2, ISO 27001, HIPAA, PCI DSS, or another independent product certification.",
          "Payment card handling is delegated to Razorpay when live checkout is enabled. OnlyMyPDF does not store full card details.",
          "Enterprise commitments apply only through a signed agreement.",
        ],
      },
      {
        title: "Report a concern",
        paragraphs: [
          `Send security, privacy, or trust questions to ${LEGAL_CONTACT.supportEmail}. Do not include passwords, private keys, or confidential files in the first message.`,
        ],
      },
    ],
  },
  hi: {
    pageTitle: "ट्रस्ट सेंटर",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "Verified technical controls",
        bullets: [
          "Transport Layer Security (TLS) browser और service traffic को transit में protect करता है।",
          "Supported files private Supabase या Cloudflare R2 object storage उपयोग करती हैं। Temporary upload grants 15 मिनट में expire और download links time-limited होते हैं।",
          "Rate limits, origin checks, signed webhooks, multi-factor authentication, step-up checks और admin audit records sensitive actions protect करते हैं।",
          "Sentry enabled होने पर error event भेजने से पहले configured sensitive headers और common personal fields हटते हैं।",
        ],
      },
      {
        title: "Retention controls",
        bullets: [
          `Free files ${FILE_LIMITS.fileRetentionHours} घंटे में और Pro files ${PUBLIC_RETENTION.proFileHours} घंटे में expire होती हैं।`,
          "Cleanup task हर घंटे चलता और failed attempt के बाद बची expired objects पर दोबारा कोशिश करता है।",
          "Account deletion के लिए recent identity verification चाहिए। यह account-linked files और product history हटाता है। Short-lived staging normal cleanup से expire होती है और legally required billing records anonymized form में रहते हैं।",
        ],
      },
      {
        title: "Provider transparency",
        bullets: [
          "Supabase, Cloudflare R2, Upstash और Railway core account, storage, queue और worker functions support करते हैं।",
          "Google Gemini, Razorpay, Resend, ConvertAPI और Sentry को data तभी मिलता है जब related feature enabled और used हो।",
          "Privacy policy provider को भेजा data और retention limits बताती है।",
        ],
      },
      {
        title: "Accuracy और signature limits",
        bullets: [
          "OnlyMyPDF हर document की perfect conversion promise नहीं करता। Complex fonts, scans, tables, formulas और layouts बदल सकते हैं।",
          "AI summaries incomplete या wrong हो सकती हैं और review जरूरी है।",
          "Sign PDF tool visual signature बनाता है, certificate-based digital signature नहीं।",
        ],
      },
      {
        title: "Compliance status",
        bullets: [
          "OnlyMyPDF अभी SOC 2, ISO 27001, HIPAA, PCI DSS या किसी independent product certification का claim नहीं करता।",
          "Live checkout enabled होने पर payment card handling Razorpay करता है। OnlyMyPDF पूरा card detail store नहीं करता।",
          "Enterprise commitments signed agreement से ही लागू होते हैं।",
        ],
      },
      {
        title: "Concern report करें",
        paragraphs: [
          `Security, privacy या trust प्रश्न ${LEGAL_CONTACT.supportEmail} पर भेजें। पहले message में password, private key या confidential file न दें।`,
        ],
      },
    ],
  },
};

export const slaLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Service level and status",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "Public service target",
        paragraphs: [
          "OnlyMyPDF targets 99.5% monthly availability for the web application and API, excluding announced maintenance. This target is operational guidance, not a contractual service-level agreement for Free or Pro plans.",
        ],
      },
      {
        title: "Status evidence",
        bullets: [
          "The Status page checks the application health endpoint and shows when required services are degraded or unreachable.",
          "Incident history and update subscriptions are available only when an external public status provider is configured.",
          "A green application check is a current snapshot, not proof of historical uptime.",
        ],
      },
      {
        title: "Maintenance and retention jobs",
        bullets: [
          "Admins can enable maintenance mode for tool routes.",
          "The cleanup job is scheduled hourly. Conversion worker health is checked separately by the watchdog.",
        ],
      },
      {
        title: "Support",
        bullets: [
          `Free and Pro users can contact ${LEGAL_CONTACT.supportEmail}. Response times are targets, not contractual guarantees.`,
          "An enterprise response commitment applies only when a signed agreement states it.",
        ],
      },
    ],
  },
  hi: {
    pageTitle: "सेवा स्तर और स्थिति",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "Public service target",
        paragraphs: [
          "OnlyMyPDF announced maintenance को छोड़कर web application और API के लिए 99.5% monthly availability target करता है। Free या Pro plans के लिए यह operational guidance है, contractual service-level agreement नहीं।",
        ],
      },
      {
        title: "Status evidence",
        bullets: [
          "Status page application health endpoint check करके required service degraded या unreachable होने पर दिखाता है।",
          "Incident history और update subscription केवल external public status provider configured होने पर मिलते हैं।",
          "Green application check current snapshot है, historical uptime का proof नहीं।",
        ],
      },
      {
        title: "Maintenance और retention jobs",
        bullets: [
          "Admins tool routes के लिए maintenance mode enable कर सकते हैं।",
          "Cleanup job हर घंटे scheduled है। Conversion worker health watchdog अलग check करता है।",
        ],
      },
      {
        title: "Support",
        bullets: [
          `Free और Pro users ${LEGAL_CONTACT.supportEmail} पर संपर्क कर सकते हैं। Response time target है, contractual guarantee नहीं।`,
          "Enterprise response commitment signed agreement में लिखे होने पर ही लागू होता है।",
        ],
      },
    ],
  },
};
