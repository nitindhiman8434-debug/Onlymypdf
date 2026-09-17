import { SUPPORT_EMAIL } from "@/config/constants";
import type { LegalDocument } from "./index";

export const privacyLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Privacy Policy",
    lastUpdated: "June 5, 2026",
    sections: [
      {
        title: "Legal basis (GDPR)",
        bullets: [
          "Contract (Art. 6(1)(b)): providing tools, accounts, and Pro subscriptions.",
          "Legitimate interest (Art. 6(1)(f)): security, fraud prevention, hashed IP metering.",
          "Consent (Art. 6(1)(a)): optional analytics/marketing cookies.",
          "Legal obligation (Art. 6(1)(c)): tax and payment records where required.",
        ],
      },
      {
        title: "Information we collect",
        bullets: [
          "Account: name, email, password (hashed).",
          "Usage: tools used, file sizes, processing times.",
          "Payment: processed by Razorpay — we do not store card numbers.",
          "Files: uploaded temporarily for processing; auto-deleted per retention policy.",
        ],
      },
      {
        title: "How we use data",
        bullets: [
          "Provide and improve PDF tools.",
          "Process payments and support requests.",
          "Enforce usage limits and prevent abuse.",
        ],
      },
      {
        title: "Data retention",
        bullets: [
          "Uploaded PDFs (free): auto-deleted within 2 hours.",
          "Uploaded PDFs (Pro): auto-deleted within 24 hours.",
          "Usage logs: 90 days; consent records: 3 years; billing: as required by law.",
          "Admin audit logs: 90 days.",
        ],
      },
      {
        title: "Your rights (GDPR)",
        bullets: [
          "Access, export, rectify, or erase personal data from dashboard settings.",
          "Withdraw cookie consent at any time.",
          "Contact us or your supervisory authority for complaints.",
        ],
      },
      {
        title: "Sub-processors",
        bullets: [
          "Supabase (database/storage), Upstash (rate limits/jobs), Razorpay (payments), Resend (email), ConvertAPI (optional conversions), Google Gemini (AI summarization), Sentry (error monitoring), cloud host (Vercel or self-hosted).",
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Privacy inquiries: privacy@onlymypdf.com or ${SUPPORT_EMAIL}`],
      },
    ],
  },
  hi: {
    pageTitle: "गोपनीयता नीति",
    lastUpdated: "5 जून, 2026",
    sections: [
      {
        title: "कानूनी आधार (GDPR)",
        bullets: [
          "अनुबंध (Art. 6(1)(b)): टूल्स, खाते और Pro सब्सक्रिप्शन।",
          "वैध हित (Art. 6(1)(f)): सुरक्षा, धोखाधड़ी रोकथाम, हैश IP मीटरिंग।",
          "सहमति (Art. 6(1)(a)): वैकल्पिक analytics/marketing कुकीज़।",
          "कानूनी दायित्व (Art. 6(1)(c)): कर और भुगतान रिकॉर्ड जहाँ आवश्यक।",
        ],
      },
      {
        title: "हम कौन सी जानकारी एकत्र करते हैं",
        bullets: [
          "खाता: नाम, ईमेल, पासवर्ड (हैश)।",
          "उपयोग: उपयोग किए गए टूल, फ़ाइल साइज़, प्रोसेसिंग समय।",
          "भुगतान: Razorpay द्वारा — कार्ड नंबर हम संग्रहीत नहीं करते।",
          "फ़ाइलें: अस्थायी प्रसंस्करण; retention नीति के अनुसार ऑटो-डिलीट।",
        ],
      },
      {
        title: "डेटा का उपयोग",
        bullets: [
          "PDF टूल्स प्रदान और सुधारना।",
          "भुगतान और सपोर्ट अनुरोध संभालना।",
          "उपयोग सीमा लागू करना और दुरुपयोग रोकना।",
        ],
      },
      {
        title: "डेटा retention",
        bullets: [
          "अपलोड PDF (फ्री): 2 घंटे के भीतर ऑटो-डिलीट।",
          "अपलोड PDF (Pro): 24 घंटे के भीतर ऑटो-डिलीट।",
          "उपयोग लॉग: 90 दिन; consent: 3 वर्ष; बिलिंग: कानूनानुसार।",
          "एडमिन audit लॉग: 90 दिन।",
        ],
      },
      {
        title: "आपके अधिकार (GDPR)",
        bullets: [
          "डैशबोर्ड सेटिंग्स से डेटा एक्सेस, एक्सपोर्ट, सुधार या मिटाना।",
          "कुकी सहमति कभी भी वापस लें।",
          "शिकायत के लिए हमसे या supervisory authority से संपर्क करें।",
        ],
      },
      {
        title: "Sub-processors",
        bullets: [
          "Supabase, Upstash, Razorpay, Resend, ConvertAPI (वैकल्पिक), Google Gemini (AI सारांश), Sentry (error monitoring), क्लाउड होस्ट (Vercel या self-hosted)।",
        ],
      },
      {
        title: "संपर्क",
        paragraphs: [`गोपनीयता प्रश्न: privacy@onlymypdf.com या ${SUPPORT_EMAIL}`],
      },
    ],
  },
};
