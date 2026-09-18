"use client";

import { FILE_LIMITS } from "@/config/constants";
import { LEGAL_CONTACT, PUBLIC_RETENTION } from "@/config/legal";
import { useTranslation } from "@/i18n";

const COPY = {
  en: {
    title: "Privacy at a glance",
    summary:
      "OnlyMyPDF processes files only to provide the tool you request. The full policy below explains storage, external processors, and your choices.",
    headers: ["Data", "Published limit"],
    rows: [
      ["Free plan files", `Expire within ${FILE_LIMITS.fileRetentionHours} hours`],
      ["Pro plan files", `Expire within ${PUBLIC_RETENTION.proFileHours} hours`],
      ["Usage and error logs", `${PUBLIC_RETENTION.usageLogDays} days`],
      ["Consent records", `${PUBLIC_RETENTION.consentRecordYears} years`],
    ],
    facts: [
      "Private object storage and signed access links",
      "Hourly cleanup with later retries after a failed deletion",
      "No sale of personal data or uploaded files",
      "Feature-specific processors are disclosed before the detailed policy ends",
    ],
    contact: "Privacy requests",
  },
  hi: {
    title: "Privacy की मुख्य जानकारी",
    summary:
      "OnlyMyPDF फ़ाइल को केवल आपके मांगे हुए tool के लिए process करता है। नीचे पूरी नीति storage, external processors और आपकी पसंद बताती है।",
    headers: ["डेटा", "प्रकाशित सीमा"],
    rows: [
      ["Free plan files", `${FILE_LIMITS.fileRetentionHours} घंटे में expire`],
      ["Pro plan files", `${PUBLIC_RETENTION.proFileHours} घंटे में expire`],
      ["Usage और error logs", `${PUBLIC_RETENTION.usageLogDays} दिन`],
      ["Consent records", `${PUBLIC_RETENTION.consentRecordYears} वर्ष`],
    ],
    facts: [
      "Private object storage और signed access links",
      "हर घंटे cleanup और failed deletion के लिए बाद में retry",
      "Personal data या uploaded files की बिक्री नहीं",
      "Detailed policy में feature-specific processors की सूची",
    ],
    contact: "Privacy अनुरोध",
  },
} as const;

export function PrivacyGdprSections() {
  const { language } = useTranslation();
  const content = COPY[language] ?? COPY.en;

  return (
    <aside
      aria-labelledby="privacy-at-a-glance"
      className="mb-10 space-y-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-6"
    >
      <div>
        <h2 id="privacy-at-a-glance" className="text-xl font-semibold text-gray-900">
          {content.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{content.summary}</p>
      </div>

      <div className="overflow-x-auto text-sm">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-4 font-semibold">{content.headers[0]}</th>
              <th className="py-2 font-semibold">{content.headers[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {content.rows.map(([type, retention]) => (
              <tr key={type}>
                <td className="py-2 pr-4">{type}</td>
                <td className="py-2">{retention}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {content.facts.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="text-sm">
        {content.contact}: {" "}
        <a
          href={`mailto:${LEGAL_CONTACT.privacyEmail}`}
          className="font-medium text-blue-700 underline-offset-4 hover:underline"
        >
          {LEGAL_CONTACT.privacyEmail}
        </a>
      </p>
    </aside>
  );
}
