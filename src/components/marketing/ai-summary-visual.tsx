"use client";

import Image from "next/image";

export function AiSummaryVisual() {
  return (
    <div className="pd-ai-summary-visual relative mx-auto w-full max-w-md origin-center scale-[1.21]">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-violet-500/25 to-indigo-400/10 blur-3xl"
      />

      <div className="relative overflow-hidden rounded-[1.5rem] border border-violet-200/60 bg-white shadow-2xl shadow-violet-500/10">
        <Image
          src="/images/hero-product-ai.webp?v=s5"
          alt="OnlyMyPDF AI PDF Summarizer report interface screenshot"
          width={900}
          height={1100}
          loading="lazy"
          unoptimized
          sizes="(max-width: 1024px) 100vw, 508px"
          className="h-auto w-full object-cover object-top"
        />
      </div>
    </div>
  );
}
