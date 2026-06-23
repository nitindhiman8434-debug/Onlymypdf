import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPageView } from "@/components/pages/ToolPageView";
import { TOOLS, getTool } from "@/lib/tools";
import { baseMetadata } from "@/lib/seo";

// Only known tool slugs are valid; anything else 404s (keeps SEO clean).
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.filter((t) => t.enabled !== false).map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tool = getTool(params.slug);
  if (!tool) return {};
  return baseMetadata("en", `/${tool.slug}`, `${tool.name.en} – Free & Private`, tool.short.en);
}

export default function Page({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug);
  if (!tool) notFound();
  return <ToolPageView tool={tool} locale="en" />;
}
