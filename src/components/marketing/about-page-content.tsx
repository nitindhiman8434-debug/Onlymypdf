"use client";

import Link from "next/link";
import { FileText, Shield, Zap, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { FILE_LIMITS, TOOLS } from "@/config/constants";

export function AboutPageContent() {
  return (
    <MarketingPageShell
      title="About OnlyMyPDF"
      description="OnlyMyPDF provides browser-based document tools with published limits, retention rules, and clear output caveats."
      eyebrow="Company"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
    >
      <div className="grid gap-12 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-pd-foreground">Our mission</h2>
          <p className="mt-4 leading-relaxed text-pd-muted">
            OnlyMyPDF gives people browser-based tools for common document work without requiring
            desktop software for every task.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-pd-foreground">Built for document work</h2>
          <p className="mt-4 leading-relaxed text-pd-muted">
            From students and freelancers to small business owners and enterprise teams, OnlyMyPDF
            is designed for anyone who works with documents.
          </p>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold text-pd-foreground">What OnlyMyPDF publishes</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, title: "Measured limits", desc: "Each plan publishes its file-size, daily-use, and retention limits." },
            { icon: Shield, title: "File retention", desc: `Free files expire within ${FILE_LIMITS.fileRetentionHours} hours. Pro files expire within 24 hours.` },
            { icon: FileText, title: `${TOOLS.length} document tools`, desc: "Organize, convert, optimize, edit, sign, secure, scan, and summarize documents." },
            { icon: Users, title: "Free to Start", desc: "5 free uses per day with no signup required." },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-pd-border bg-pd-surface p-6 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-pd-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-pd-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-2xl bg-pd-brand p-8 text-center text-white sm:p-12">
        <h2 className="text-2xl font-bold sm:text-3xl">Choose a document tool</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85">
          Basic tools work without signup and follow the published Free plan limits.
        </p>
        <Link href="/#tools" className="mt-6 inline-block">
          <Button size="lg" variant="secondary" className="bg-white text-pd-brand hover:bg-white/90">
            Explore PDF Tools
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    </MarketingPageShell>
  );
}
