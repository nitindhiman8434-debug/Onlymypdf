import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { getApiUser } from "@/lib/auth/get-api-user";

import { verifyUserStepUp } from "@/lib/auth/verify-reauth";

import { clearStepUpCookie } from "@/lib/auth/step-up-auth";

import { guardMutationOrigin } from "@/lib/server/mutation-origin";

import { checkReauthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";

import { toSafeApiError } from "@/lib/server/safe-error";



export async function POST(request: NextRequest) {

  try {

    const originBlocked = guardMutationOrigin(request);

    if (originBlocked) return originBlocked;



    const user = await getApiUser();

    if (!user) {

      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    }



    const reauthRate = await checkReauthRateLimit(request, user.id);

    if (!reauthRate.allowed) return rateLimitResponse(reauthRate.retryAfterSec);



    const body = await request.json().catch(() => ({}));

    const password = typeof body.password === "string" ? body.password : "";



    const reauthOk = await verifyUserStepUp({

      request,

      userId: user.id,

      email: user.email,

      purpose: "mfa_enroll",

      password,

    });



    if (!reauthOk) {

      return NextResponse.json(

        {

          error: password

            ? "Incorrect password."

            : "Confirm your identity before setting up two-factor authentication.",

        },

        { status: 403 }

      );

    }



    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.enroll({

      factorType: "totp",

      friendlyName: "Authenticator app",

    });



    if (error || !data) {

      return NextResponse.json({ error: error?.message ?? "MFA enrollment failed" }, { status: 400 });

    }



    const response = NextResponse.json({

      factorId: data.id,

      qrCode: data.totp?.qr_code,

      secret: data.totp?.secret,

      uri: data.totp?.uri,

    });

    return clearStepUpCookie(response);

  } catch (err) {

    return NextResponse.json({ error: toSafeApiError(err, "MFA enrollment failed") }, { status: 500 });

  }

}
