import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPageView } from "@/components/pages/misc";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/lib/legal";
import { baseMetadata } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = LEGAL_DOCS[params.slug];
  if (!doc) return {};
  return baseMetadata("hi", `/legal/${doc.slug}`, doc.title.hi, doc.body.hi.slice(0, 150));
}

export default function Page({ params }: { params: { slug: string } }) {
  if (!LEGAL_DOCS[params.slug]) notFound();
  return <LegalPageView locale="hi" slug={params.slug} />;
}
