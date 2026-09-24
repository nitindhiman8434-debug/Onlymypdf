import { FILE_LIMITS } from "@/config/constants";
import { LEGAL_CONTACT, LEGAL_POLICY_DATE, PUBLIC_RETENTION } from "@/config/legal";
import type { LegalDocument } from "./index";

const freeRetention = FILE_LIMITS.fileRetentionHours;
const proRetention = PUBLIC_RETENTION.proFileHours;

export const privacyLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Privacy policy",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "Who controls your data",
        paragraphs: [
          `${LEGAL_CONTACT.operatorName}, operating from ${LEGAL_CONTACT.operatorCountry}, controls the personal data described in this policy. Contact ${LEGAL_CONTACT.privacyEmail} for privacy requests.`,
          "This policy covers the OnlyMyPDF website, accounts, PDF tools, support, and paid features.",
        ],
      },
      {
        title: "Data we collect",
        bullets: [
          "Account data: name, email address, authentication identifiers, plan, and security settings. Supabase manages account passwords; OnlyMyPDF does not store readable passwords.",
          "Tool activity: tool name, file size, processing time, status, and a hashed network identifier for limits and abuse prevention.",
          "Files: the documents you submit and generated outputs when a tool needs server processing or temporary storage.",
          "Billing data: payment identifiers, plan, amount, currency, status, and invoice details. OnlyMyPDF does not store full card or bank credentials.",
          "Support data: the name, email address, subject, and message you submit through the contact form.",
          "AI activity: provider, model, token counts, estimated cost, and success status when you use AI summarization.",
          "Optional conversion feedback: ratings, your comment, the linked completed job, consent version, publication choice, moderation status, and submission time. File names, document contents, and account email are not copied into the feedback record.",
        ],
      },
      {
        title: "Why we process data",
        bullets: [
          "Contract: deliver requested tools, accounts, downloads, and paid features.",
          "Legitimate interests: protect the service, enforce limits, diagnose failures, and prevent fraud or abuse.",
          "Consent: store optional analytics or marketing preferences and send optional communications when offered.",
          "Consent: store conversion feedback for product-quality research and, only when separately allowed by you and approved by staff, publish the comment without your account details or document data.",
          "Legal obligations: keep billing, tax, fraud, and dispute records when law requires it.",
        ],
      },
      {
        title: "File processing and retention",
        bullets: [
          `Free plan files expire within ${freeRetention} hours. Pro plan files expire within ${proRetention} hours. A tool may delete temporary data sooner.`,
          `Usage, AI usage, and error logs are scheduled for deletion after ${PUBLIC_RETENTION.usageLogDays} days. Admin audit logs are scheduled for deletion after ${PUBLIC_RETENTION.adminAuditLogDays} days.`,
          `Consent records are scheduled for deletion after ${PUBLIC_RETENTION.consentRecordYears} years. Billing and tax records may remain longer when applicable law requires it.`,
          "Cleanup runs every hour. A failed deletion is retried on a later run, so a technical failure can delay removal beyond the target window.",
          "Deleting your account removes account data, account-linked files, job history, API keys, usage logs, and consent records. Short-lived conversion staging that is not linked to the profile expires through the normal cleanup window. Billing records may be anonymized and retained when legally required.",
          "Conversion feedback remains until you withdraw it from Dashboard feedback or delete your account. Withdrawing feedback deletes the stored submission; publication consent never makes a submission public automatically.",
        ],
      },
      {
        title: "AI summarization",
        bullets: [
          "When you request an AI summary, OnlyMyPDF extracts text from the PDF and sends up to 100,000 characters to Google Gemini when that provider is enabled.",
          "OnlyMyPDF records usage metadata for limits and operations. It does not intentionally store the extracted document text in AI usage logs.",
          "Do not submit confidential or regulated data to AI summarization unless you have authority and accept the provider processing described here.",
        ],
      },
      {
        title: "Infrastructure and subprocessors",
        bullets: [
          "Supabase: authentication, database, and private object storage for account and tool data.",
          "Cloudflare R2: private temporary object storage for supported conversion jobs.",
          "Upstash: rate limits and conversion job coordination.",
          "Railway: dedicated conversion worker compute.",
          "Feature-specific processors: Google Gemini for AI summaries; Razorpay for live payments; Resend for email; ConvertAPI for supported conversions; Sentry for error monitoring. These processors receive data only when the related feature is enabled and used.",
        ],
      },
      {
        title: "Sharing, sale, and international processing",
        paragraphs: [
          "OnlyMyPDF does not sell personal data or uploaded files. We share data with processors only to operate a requested feature, protect the service, comply with law, or respond to a valid legal request.",
          "Data may be processed in India and in regions where a processor operates. We use provider agreements, access controls, and Transport Layer Security (TLS) for transfers where applicable.",
        ],
      },
      {
        title: "Your choices and rights",
        bullets: [
          "Use Dashboard settings to export account data, change cookie preferences, or request account deletion after confirming your identity.",
          "You may request access, correction, deletion, restriction, objection, or portability where applicable law grants that right.",
          "You may withdraw optional cookie consent at any time. Withdrawal does not affect earlier lawful processing.",
          "You may withdraw and delete conversion feedback from Dashboard feedback at any time. Publication requires a separate optional choice and staff review.",
          "You may complain to your local data protection authority.",
        ],
      },
      {
        title: "Security and children",
        paragraphs: [
          "OnlyMyPDF uses private storage, signed access links, rate limits, access controls, and TLS. No online service can guarantee absolute security.",
          "OnlyMyPDF is not directed to children who cannot legally consent to data processing in their country. A parent or guardian should contact us if a child submitted personal data without valid permission.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          `Send privacy requests to ${LEGAL_CONTACT.privacyEmail}. Send general support requests to ${LEGAL_CONTACT.supportEmail}.`,
        ],
      },
    ],
  },
  hi: {
    pageTitle: "गोपनीयता नीति",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "आपके डेटा का नियंत्रक",
        paragraphs: [
          `${LEGAL_CONTACT.operatorName}, ${LEGAL_CONTACT.operatorCountry} से संचालित, इस नीति में बताए गए व्यक्तिगत डेटा को नियंत्रित करता है। गोपनीयता अनुरोध के लिए ${LEGAL_CONTACT.privacyEmail} पर संपर्क करें।`,
          "यह नीति OnlyMyPDF वेबसाइट, खाते, PDF टूल्स, सपोर्ट और भुगतान वाले फीचर्स पर लागू होती है।",
        ],
      },
      {
        title: "हम कौन सा डेटा लेते हैं",
        bullets: [
          "खाता डेटा: नाम, ईमेल, प्रमाणीकरण पहचान, प्लान और सुरक्षा सेटिंग्स। Supabase पासवर्ड संभालता है; OnlyMyPDF पढ़े जा सकने वाले पासवर्ड स्टोर नहीं करता।",
          "टूल गतिविधि: टूल का नाम, फ़ाइल साइज़, प्रोसेसिंग समय, स्थिति और सीमा या दुरुपयोग रोकने के लिए हैश किया गया नेटवर्क पहचानकर्ता।",
          "फ़ाइलें: सर्वर प्रोसेसिंग या अस्थायी स्टोरेज की जरूरत होने पर जमा दस्तावेज़ और तैयार आउटपुट।",
          "बिलिंग डेटा: भुगतान ID, प्लान, राशि, मुद्रा, स्थिति और इनवॉइस विवरण। पूरा कार्ड या बैंक विवरण OnlyMyPDF स्टोर नहीं करता।",
          "सपोर्ट डेटा: कॉन्टैक्ट फॉर्म में दिया नाम, ईमेल, विषय और संदेश।",
          "AI गतिविधि: AI सारांश उपयोग करने पर provider, model, token count, अनुमानित लागत और सफलता की स्थिति।",
          "वैकल्पिक conversion feedback: ratings, आपका comment, linked completed job, consent version, publication choice, moderation status और submission time। Feedback record में file name, document content या account email copy नहीं होते।",
        ],
      },
      {
        title: "हम डेटा क्यों प्रोसेस करते हैं",
        bullets: [
          "अनुबंध: अनुरोधित टूल, खाते, डाउनलोड और भुगतान वाले फीचर्स देना।",
          "वैध हित: सेवा की सुरक्षा, सीमा लागू करना, विफलता जांचना और धोखाधड़ी या दुरुपयोग रोकना।",
          "सहमति: वैकल्पिक analytics या marketing पसंद स्टोर करना और उपलब्ध होने पर वैकल्पिक संदेश भेजना।",
          "सहमति: product-quality research के लिए conversion feedback स्टोर करना और केवल आपकी अलग अनुमति व staff approval के बाद account details या document data के बिना comment प्रकाशित करना।",
          "कानूनी दायित्व: कानून के अनुसार बिलिंग, कर, धोखाधड़ी और विवाद रिकॉर्ड रखना।",
        ],
      },
      {
        title: "फ़ाइल प्रोसेसिंग और retention",
        bullets: [
          `फ्री प्लान की फ़ाइलें ${freeRetention} घंटे में और Pro फ़ाइलें ${proRetention} घंटे में expire होती हैं। कोई टूल अस्थायी डेटा इससे पहले मिटा सकता है।`,
          `Usage, AI usage और error logs ${PUBLIC_RETENTION.usageLogDays} दिन बाद मिटाने के लिए निर्धारित हैं। Admin audit logs ${PUBLIC_RETENTION.adminAuditLogDays} दिन बाद मिटाने के लिए निर्धारित हैं।`,
          `Consent records ${PUBLIC_RETENTION.consentRecordYears} वर्ष बाद मिटाने के लिए निर्धारित हैं। कानून आवश्यक होने पर billing और tax records अधिक समय रह सकते हैं।`,
          "Cleanup हर घंटे चलता है। Delete विफल होने पर अगला run दोबारा कोशिश करता है, इसलिए तकनीकी विफलता target समय से अधिक देरी कर सकती है।",
          "खाता मिटाने पर account data, account-linked files, job history, API keys, usage logs और consent records हटते हैं। Profile से linked न होने वाली short-lived conversion staging normal cleanup window में expire होती है। कानूनी जरूरत पर billing records anonymize करके रखे जा सकते हैं।",
          "Conversion feedback तब तक रहता है जब तक आप Dashboard feedback से इसे वापस न लें या account delete न करें। Feedback वापस लेने पर stored submission delete होता है; publication consent से कोई submission अपने-आप public नहीं होता।",
        ],
      },
      {
        title: "AI सारांश",
        bullets: [
          "AI summary मांगने पर OnlyMyPDF PDF से text निकालता है और provider enabled होने पर अधिकतम 100,000 characters Google Gemini को भेजता है।",
          "OnlyMyPDF सीमा और संचालन के लिए usage metadata रखता है। AI usage logs में निकाला गया document text जानबूझकर स्टोर नहीं किया जाता।",
          "अधिकार और provider processing स्वीकार किए बिना confidential या regulated data AI summarizer में न दें।",
        ],
      },
      {
        title: "Infrastructure और subprocessors",
        bullets: [
          "Supabase: authentication, database और account या tool data के लिए private object storage।",
          "Cloudflare R2: supported conversion jobs के लिए private temporary object storage।",
          "Upstash: rate limits और conversion job coordination।",
          "Railway: dedicated conversion worker compute।",
          "Feature-specific processors: AI summary के लिए Google Gemini; live payment के लिए Razorpay; email के लिए Resend; supported conversion के लिए ConvertAPI; error monitoring के लिए Sentry। संबंधित feature enabled और used होने पर ही उन्हें data मिलता है।",
        ],
      },
      {
        title: "Sharing, sale और international processing",
        paragraphs: [
          "OnlyMyPDF personal data या uploaded files नहीं बेचता। अनुरोधित feature चलाने, सेवा सुरक्षित रखने, कानून मानने या वैध कानूनी अनुरोध का जवाब देने के लिए ही processor के साथ data share होता है।",
          "Data भारत और processor के operating regions में process हो सकता है। लागू होने पर provider agreements, access controls और Transport Layer Security (TLS) उपयोग होते हैं।",
        ],
      },
      {
        title: "आपकी पसंद और अधिकार",
        bullets: [
          "Dashboard settings से account data export करें, cookie preference बदलें या पहचान confirm करके account deletion मांगें।",
          "लागू कानून के अनुसार access, correction, deletion, restriction, objection या portability मांग सकते हैं।",
          "वैकल्पिक cookie consent कभी भी वापस ले सकते हैं। इससे पहले की वैध processing पर असर नहीं पड़ता।",
          "Dashboard feedback से conversion feedback कभी भी वापस लेकर delete कर सकते हैं। Publication के लिए अलग optional choice और staff review जरूरी है।",
          "स्थानीय data protection authority को शिकायत कर सकते हैं।",
        ],
      },
      {
        title: "सुरक्षा और बच्चे",
        paragraphs: [
          "OnlyMyPDF private storage, signed access links, rate limits, access controls और TLS उपयोग करता है। कोई online service पूरी सुरक्षा की guarantee नहीं दे सकती।",
          "OnlyMyPDF उन बच्चों के लिए निर्देशित नहीं है जो अपने देश में data processing की कानूनी सहमति नहीं दे सकते। बिना वैध अनुमति बच्चे ने data दिया हो तो parent या guardian संपर्क करें।",
        ],
      },
      {
        title: "संपर्क",
        paragraphs: [
          `Privacy अनुरोध ${LEGAL_CONTACT.privacyEmail} पर और सामान्य support अनुरोध ${LEGAL_CONTACT.supportEmail} पर भेजें।`,
        ],
      },
    ],
  },
};
