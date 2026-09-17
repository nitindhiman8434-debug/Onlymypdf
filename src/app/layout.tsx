import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AuthProvider } from "@/components/providers/auth-provider";
import { LanguageProvider } from "@/i18n";
import { LangSync } from "@/components/i18n/lang-sync";
import { HindiFontLoader } from "@/components/i18n/hindi-font-loader";
import { DesignPreviewProvider } from "@/components/design/design-preview-provider";
import { LogoPreviewProvider } from "@/components/providers/logo-preview-provider";
import { HeroVariantProvider } from "@/components/marketing/hero-variant-provider";
import { CookieConsentBanner } from "@/components/privacy/cookie-consent";
import { DevPreviewOverlays } from "@/components/layout/dev-preview-overlays";
import { AppChromeExtras } from "@/components/layout/app-chrome-extras";
import {
  DEFAULT_BRAND_THEME,
  DEFAULT_LAYOUT_STYLE,
  LAYOUT_BODY_CLASS,
} from "@/config/design-system";
import { APP_DESCRIPTION, APP_NAME, APP_URL } from "@/config/constants";
import { buildLanguageAlternates } from "@/lib/seo/language-alternates";
import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/lib/seo/json-ld";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — Free Online PDF Tools`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "PDF tools",
    "compress PDF",
    "merge PDF",
    "convert PDF",
    "edit PDF",
    "sign PDF",
    "PDF to Word",
    "free PDF editor",
    "online PDF tools",
    APP_NAME,
  ],
  applicationName: APP_NAME,
  openGraph: {
    title: `${APP_NAME} — Free Online PDF Tools`,
    description: APP_DESCRIPTION,
    type: "website",
    siteName: APP_NAME,
    locale: "en_US",
    url: APP_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Free Online PDF Tools`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Free Online PDF Tools`,
    description: APP_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    ...buildLanguageAlternates("/"),
    types: {
      "text/plain": "/llms.txt",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const locale = headerList.get("x-locale") === "hi" ? "hi" : "en";
  const nonce = headerList.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-brand-theme={DEFAULT_BRAND_THEME}
      data-layout-style={DEFAULT_LAYOUT_STYLE}
      className={`${inter.variable} ${plusJakarta.variable} ${LAYOUT_BODY_CLASS[DEFAULT_LAYOUT_STYLE]} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} nonce={nonce} />
        <a href="#main-content" className="pd-skip-link">
          Skip to main content
        </a>
        <LogoPreviewProvider>
          <DesignPreviewProvider>
            <HeroVariantProvider>
              <LanguageProvider>
                <LangSync />
                <HindiFontLoader />
                <AuthProvider>
                  <Header />
                  <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
                    {children}
                  </main>
                  <Footer />
                  <CookieConsentBanner />
                  <DevPreviewOverlays />
                  <AppChromeExtras />
                </AuthProvider>
              </LanguageProvider>
            </HeroVariantProvider>
          </DesignPreviewProvider>
        </LogoPreviewProvider>
      </body>
    </html>
  );
}
