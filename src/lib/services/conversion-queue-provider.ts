import { isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { isUpstashConfigured } from "@/lib/server/upstash-kv";

export type ConversionQueueProvider = "supabase" | "upstash" | "memory" | "unavailable";

export function getConversionQueueProvider(): ConversionQueueProvider {
  const requested = process.env.CONVERSION_QUEUE_PROVIDER?.trim().toLowerCase();

  if (requested === "supabase") {
    return isSupabaseServiceConfigured() ? "supabase" : "unavailable";
  }
  if (requested === "upstash") {
    return isUpstashConfigured() ? "upstash" : "unavailable";
  }
  if (requested === "memory") return "memory";
  if (requested) return "unavailable";

  if (isSupabaseServiceConfigured()) return "supabase";
  if (isUpstashConfigured()) return "upstash";
  return "memory";
}

export function isDurableConversionQueueConfigured(): boolean {
  const provider = getConversionQueueProvider();
  return provider === "supabase" || provider === "upstash";
}
