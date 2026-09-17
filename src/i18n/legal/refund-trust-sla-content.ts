import { SUPPORT_EMAIL } from "@/config/constants";

import { BILLING_COPY } from "@/lib/billing/billing-copy";

import type { LegalDocument } from "./index";



export const refundLegal: Record<"en" | "hi", LegalDocument> = {

  en: {

    pageTitle: "Refund Policy",

    lastUpdated: "July 1, 2026",

    sections: [

      {

        title: "1. Eligibility",

        paragraphs: [

          "OnlyMyPDF Pro is sold as a monthly or yearly plan via Razorpay — as an auto-renewing subscription when plan IDs are configured, or as a one-time plan purchase otherwise.",

          "Refund requests for your most recent Pro payment are reviewed per this policy. Approved refunds are processed to the original payment method, except where required otherwise by applicable law.",

        ],

      },

      {

        title: "2. How to request",

        bullets: [

          `Email ${SUPPORT_EMAIL} from your registered account email.`,

          "Include your payment date, Razorpay payment ID, and reason for the request.",

          "We respond within 2 business days and process approved refunds within 5–10 business days to the original payment method.",

        ],

      },

      {

        title: "3. Non-refundable cases",

        bullets: [

          "Requests that do not meet eligibility under this policy (unless legally required).",

          "Accounts terminated for abuse, fraud, or terms violations.",

          "Enterprise or custom invoiced contracts (separate agreement applies).",

        ],

      },

      {

        title: "4. GST invoices",

        paragraphs: [

          "GST tax invoices are generated after successful Pro payments. Download them from Dashboard → Billing. Refunds follow the same payment channel as the original charge.",

        ],

      },

    ],

  },

  hi: {

    pageTitle: "रिफंड नीति",

    lastUpdated: "1 जुलाई, 2026",

    sections: [

      {

        title: "1. पात्रता",

        paragraphs: [

          "OnlyMyPDF Pro Razorpay के ज़रिए मासिक या वार्षिक प्लान के रूप में बिकता है — subscription (auto-renew) या one-time खरीद, कॉन्फ़िगरेशन पर निर्भर।",

          "हाल के Pro भुगतान के रिफंड अनुरोध इस नीति के अनुसार समीक्षा किए जाते हैं। स्वीकृत रिफंड मूल भुगतान विधि पर प्रोसेस होते हैं (जब तक कानून अन्यथा न मांगे)।",

        ],

      },

      {

        title: "2. अनुरोध कैसे करें",

        bullets: [

          `अपने पंजीकृत ईमेल से ${SUPPORT_EMAIL} पर लिखें।`,

          "भुगतान तिथि, Razorpay payment ID और कारण शामिल करें।",

          "2 कार्य दिवसों में जवाब; स्वीकृत रिफंड 5–10 कार्य दिवसों में मूल भुगतान विधि पर।",

        ],

      },

      {

        title: "3. गैर-रिफंड योग्य",

        bullets: [

          "इस नीति के अंतर्गत पात्रता पूरी न करने वाले अनुरोध (कानूनी अपवाद को छोड़कर)।",

          "दुरुपयोग, धोखाधड़ी या शर्तों के उल्लंघन पर बंद खाते।",

          "Enterprise / custom invoice अनुबंध (अलग समझौता)।",

        ],

      },

      {

        title: "4. GST इनवॉइस",

        paragraphs: [

          "सफल Pro भुगतान के बाद GST tax invoice जारी होता है। Dashboard → Billing से डाउनलोड करें।",

        ],

      },

    ],

  },

};



export const trustLegal: Record<"en" | "hi", LegalDocument> = {

  en: {

    pageTitle: "Trust Center",

    lastUpdated: "July 1, 2026",

    sections: [

      {

        title: "Security",

        bullets: [

          "TLS in transit; private Supabase storage with signed download URLs.",

          "Rate limiting, CSRF protection on sensitive routes, webhook HMAC verification.",

          "Admin audit log for settings and user moderation actions.",

        ],

      },

      {

        title: "Privacy & GDPR",

        bullets: [

          "JSON data export and account deletion with password confirmation.",

          "Consent logging, retention cron, anonymized billing records on delete.",

        ],

      },

      {

        title: "Billing transparency",

        bullets: [

          "Pro checkout via Razorpay in INR; GST invoices in Dashboard → Billing.",

          BILLING_COPY.checkoutModel,

          "Staging environments may use mock billing (no real charges).",

        ],

      },

      {

        title: "Enterprise readiness",

        bullets: [

          "Organization accounts with team seats, shared daily limits, and member invites.",

          "API keys for programmatic PDF tools (Pro or active team plan required).",

          "SSO (SAML/OIDC) and custom SLAs available via enterprise sales — not self-serve on all tiers.",

        ],

      },

    ],

  },

  hi: {

    pageTitle: "ट्रस्ट सेंटर",

    lastUpdated: "1 जुलाई, 2026",

    sections: [

      {

        title: "सुरक्षा",

        bullets: [

          "TLS, निजी स्टोरेज, signed URLs, rate limiting, CSRF, webhook HMAC, audit log।",

        ],

      },

      {

        title: "प्राइवेसी और GDPR",

        bullets: [

          "JSON export, account delete, consent logging, billing records retention।",

        ],

      },

      {

        title: "बिलिंग पारदर्शिता",

        bullets: [

          "Razorpay INR checkout; GST invoices Dashboard → Billing में।",

          "Staging पर mock billing (कोई वास्तविक शुल्क नहीं)।",

        ],

      },

      {

        title: "Enterprise",

        bullets: [

          "Organizations, team seats, invites, API keys (Pro/team plan)।",

          "SSO और custom SLA — enterprise sales के माध्यम से।",

        ],

      },

    ],

  },

};



export const slaLegal: Record<"en" | "hi", LegalDocument> = {

  en: {

    pageTitle: "Service Level",

    lastUpdated: "July 1, 2026",

    sections: [

      {

        title: "Availability target",

        paragraphs: [

          "We target 99.5% monthly uptime for the OnlyMyPDF web application and API, excluding scheduled maintenance announced in advance. Monitor live status at /status or your configured external status page.",

        ],

      },

      {

        title: "Maintenance",

        bullets: [

          "Maintenance mode can be enabled by admins — users see a clear message on tool routes.",

          "Hourly cleanup cron removes expired files and stale jobs.",

        ],

      },

      {

        title: "Support response",

        bullets: [

          `Free users: best-effort email support at ${SUPPORT_EMAIL}.`,

          "Pro users: priority queue (1–2 business days).",

          "Enterprise: custom SLA by contract.",

        ],

      },

    ],

  },

  hi: {

    pageTitle: "सेवा स्तर",

    lastUpdated: "1 जुलाई, 2026",

    sections: [

      {

        title: "उपलब्धता",

        paragraphs: [

          "हम 99.5% मासिक uptime का लक्ष्य रखते हैं (घोषित maintenance को छोड़कर)। /status पर live स्थिति देखें।",

        ],

      },

      {

        title: "Maintenance",

        bullets: [

          "Admin maintenance mode; hourly cleanup cron।",

        ],

      },

      {

        title: "सपोर्ट",

        bullets: [

          `Free: ${SUPPORT_EMAIL} पर best-effort email।`,

          "Pro: priority queue (1–2 कार्य दिवस)।",

          "Enterprise: contract SLA।",

        ],

      },

    ],

  },

};


