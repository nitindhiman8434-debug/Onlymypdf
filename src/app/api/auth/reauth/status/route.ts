import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { isStepUpPurpose, verifyStepUpCookie } from "@/lib/auth/step-up-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await tryGetApiUser({ skipMfaAssurance: true });
    if (!auth.ok) return auth.response;

    const purpose = request.nextUrl.searchParams.get("purpose");
    if (!isStepUpPurpose(purpose)) {
      return NextResponse.json({ error: "Invalid step-up purpose." }, { status: 400 });
    }

    const ready = verifyStepUpCookie(request, auth.user.id, purpose);
    return NextResponse.json({ ready });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check step-up status" },
      { status: 500 }
    );
  }
}
