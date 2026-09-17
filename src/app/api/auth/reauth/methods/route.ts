import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { resolveUserAuthMethods } from "@/lib/auth/user-auth-methods";

export async function GET() {
  try {
    const auth = await tryGetApiUser({ skipMfaAssurance: true });
    if (!auth.ok) return auth.response;

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const methods = resolveUserAuthMethods(user.identities);
    return NextResponse.json(methods);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load auth methods" },
      { status: 500 }
    );
  }
}
