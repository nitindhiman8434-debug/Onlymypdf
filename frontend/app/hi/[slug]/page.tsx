import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPageView } from "@/components/pages/ToolPageView";
import { TOOLS, getTool } from "@/lib/tools";
import { baseMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.filter((t) => t.enabled !== false).map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tool = getTool(params.slug);
  if (!tool) return {};
  return baseMetadata("hi", `/${tool.slug}`, `${tool.name.hi} – मुफ़्त और निजी`, tool.short.hi);
}

export default function Page({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug);
  if (!tool) notFound();
  return <ToolPageView tool={tool} locale="hi" />;
}
