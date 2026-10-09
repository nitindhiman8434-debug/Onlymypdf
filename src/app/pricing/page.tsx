"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PricingPageContent } from "@/components/marketing/pricing-page-content";
import { useAuthContext } from "@/components/providers/auth-provider";

export default function PricingPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard/pricing");
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-pd-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pd-brand border-t-transparent" />
      </div>
    );
  }

  return <PricingPageContent />;
}
