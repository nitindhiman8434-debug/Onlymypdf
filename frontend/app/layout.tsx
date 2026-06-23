import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { DEFAULT_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s · OnlyMyPDF" },
  description:
    "Fast, private, powerful PDF tools. Convert, compress, merge, sign, scan, translate, and fix PDFs in seconds — with high-accuracy conversion, AI tools, and 1-hour auto-delete.",
  applicationName: "OnlyMyPDF",
  keywords: ["PDF tools", "compress PDF", "PDF to Word", "merge PDF", "PDF to Excel", "OnlyMyPDF"],
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${devanagari.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
