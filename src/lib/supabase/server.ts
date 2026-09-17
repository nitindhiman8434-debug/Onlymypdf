import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDc1MzY4MDAsImV4cCI6MTk2MzExMjgwMH0.placeholder";

function getUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || raw.includes("your_supabase")) return PLACEHOLDER_URL;
  try {
    new URL(raw);
    return raw;
  } catch {
    return PLACEHOLDER_URL;
  }
}

function getAnonKey() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!raw || raw.length < 20 || raw.includes("your_supabase")) return PLACEHOLDER_KEY;
  return raw;
}

function getServiceKey() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw || raw.length < 20 || raw.includes("your_")) return PLACEHOLDER_KEY;
  return raw;
}

export function isSupabaseConfigured(): boolean {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!raw || !key || raw.includes("your_supabase") || key.includes("your_supabase")) {
    return false;
  }
  try {
    new URL(raw);
    return key.length > 20;
  } catch {
    return false;
  }
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getUrl(), getAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from a Server Component where cookies
          // cannot be set. This can be safely ignored when the
          // middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Client that never reads or writes the request's auth cookies. Use for
 * password verification (step-up) so `signInWithPassword` does not replace the
 * caller's existing (AAL2) session with a fresh AAL1 session.
 */
export function createEphemeralClient() {
  return createServerClient(getUrl(), getAnonKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Intentionally no-op: this session must never be persisted.
      },
    },
  });
}

export async function createServiceClient() {
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );

  return createSupabaseClient(getUrl(), getServiceKey());
}
