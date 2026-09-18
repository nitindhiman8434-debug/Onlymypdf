import { LEGAL_POLICY_DATE } from "@/config/legal";
import type { LegalDocument } from "./index";

export const cookiesLegal: Record<"en" | "hi", LegalDocument> = {
  en: {
    pageTitle: "Cookie policy",
    lastUpdated: LEGAL_POLICY_DATE.en,
    sections: [
      {
        title: "How OnlyMyPDF uses browser storage",
        paragraphs: [
          "OnlyMyPDF uses cookies and local browser storage to keep the service secure, remember your language and privacy choices, identify a guest session, and maintain sign-in state.",
          "Essential storage is required for requested features. Optional analytics and marketing storage remains off unless you choose it.",
        ],
      },
      {
        title: "Essential cookies",
        bullets: [
          "pd_guest_session: identifies a guest for authorization and daily limits. It is HTTP-only and lasts up to one year.",
          "pd_locale: remembers the selected language for up to one year.",
          "pd_consent: remembers cookie choices for up to one year. The same choice is also stored in local browser storage.",
          "Supabase authentication cookies: maintain a signed-in session and refresh it securely. Their lifetime follows the authentication session.",
          "pd_step_up: confirms recent identity verification for sensitive account actions. It is HTTP-only and expires after five minutes.",
        ],
      },
      {
        title: "Optional categories",
        bullets: [
          "Analytics: allowed only after consent. The current application does not load an analytics tag.",
          "Marketing: allowed only after consent. The current application does not load advertising or marketing tags.",
          "Saving an optional preference does not activate a provider that is not configured. If OnlyMyPDF enables one later, this policy and the consent version must be updated.",
        ],
      },
      {
        title: "Third-party features",
        paragraphs: [
          "A third party may set its own storage when you deliberately open a feature it provides, such as live Razorpay checkout or an external status page. Its policy governs that storage.",
        ],
      },
      {
        title: "Change or withdraw consent",
        paragraphs: [
          "Use the cookie banner or Dashboard settings to accept, reject, or reset optional preferences. Rejecting optional categories does not disable essential account, security, or tool functions.",
        ],
      },
    ],
  },
  hi: {
    pageTitle: "कुकी नीति",
    lastUpdated: LEGAL_POLICY_DATE.hi,
    sections: [
      {
        title: "OnlyMyPDF browser storage कैसे उपयोग करता है",
        paragraphs: [
          "OnlyMyPDF सेवा सुरक्षित रखने, भाषा और privacy पसंद याद रखने, guest session पहचानने और sign-in बनाए रखने के लिए cookies और local browser storage उपयोग करता है।",
          "अनुरोधित features के लिए essential storage जरूरी है। Analytics और marketing storage आपकी अनुमति के बिना बंद रहता है।",
        ],
      },
      {
        title: "Essential cookies",
        bullets: [
          "pd_guest_session: authorization और daily limit के लिए guest पहचानता है। यह HTTP-only है और अधिकतम एक वर्ष रहता है।",
          "pd_locale: चुनी हुई भाषा अधिकतम एक वर्ष याद रखता है।",
          "pd_consent: cookie पसंद अधिकतम एक वर्ष याद रखता है। यही पसंद local browser storage में भी रहती है।",
          "Supabase authentication cookies: signed-in session बनाए रखते और सुरक्षित रूप से refresh करते हैं। इनका समय authentication session पर निर्भर है।",
          "pd_step_up: sensitive account action के लिए हाल की identity verification confirm करता है। यह HTTP-only है और पांच मिनट में expire होता है।",
        ],
      },
      {
        title: "वैकल्पिक categories",
        bullets: [
          "Analytics: consent के बाद ही allowed। Current application कोई analytics tag load नहीं करता।",
          "Marketing: consent के बाद ही allowed। Current application advertising या marketing tag load नहीं करता।",
          "Preference save करने से unconfigured provider active नहीं होता। भविष्य में provider enable होने पर policy और consent version update करना जरूरी है।",
        ],
      },
      {
        title: "Third-party features",
        paragraphs: [
          "Live Razorpay checkout या external status page जैसा feature खोलने पर third party अपना storage रख सकता है। उस storage पर उसकी policy लागू होती है।",
        ],
      },
      {
        title: "Consent बदलें या वापस लें",
        paragraphs: [
          "Cookie banner या Dashboard settings से optional preference accept, reject या reset करें। Optional categories reject करने से essential account, security या tool functions बंद नहीं होते।",
        ],
      },
    ],
  },
};
