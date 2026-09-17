import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import {

  getLocalDevSessionUser,

  isLocalDevAuthEnabled,

} from "@/lib/auth/local-dev-auth";

import { getUserProfile } from "@/lib/db/queries";

import { isActivePro, isBlockedProfile, UserBlockedError } from "@/lib/auth/plan-access";

import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";

import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";

import { authGuardResponse } from "@/lib/server/auth-guard-http";



export interface ApiUser {

  id: string;

  email: string;

  plan: "free" | "pro";

}



export type GetApiUserOptions = {

  /** Allow AAL1 session (MFA status, enrollment, session bootstrap). */

  skipMfaAssurance?: boolean;

};



export async function getApiUser(options?: GetApiUserOptions): Promise<ApiUser | null> {

  if (isLocalDevAuthEnabled()) {

    const user = await getLocalDevSessionUser();

    if (!user) return null;



    return {

      id: user.id,

      email: user.email,

      plan: user.plan,

    };

  }



  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();



  if (!user) return null;



  if (!options?.skipMfaAssurance) {

    await assertMfaAal2Satisfied(supabase);

  }



  const profile = await getUserProfile(user.id);



  if (isBlockedProfile(profile)) {

    throw new UserBlockedError();

  }



  let plan: "free" | "pro" = "free";

  try {

    const access = await resolveProAccessForUser(user.id);

    plan = access.isPro ? "pro" : "free";

  } catch {
    plan = isActivePro(profile ?? {}) ? "pro" : "free";
  }



  return {

    id: user.id,

    email: user.email ?? "",

    plan,

  };

}



export type ApiUserResult =

  | { ok: true; user: ApiUser }

  | { ok: false; response: NextResponse };



/** Resolves API user or returns 401 / 403 (blocked / MFA pending). */

export async function tryGetApiUser(

  options?: GetApiUserOptions

): Promise<ApiUserResult> {

  try {

    const user = await getApiUser(options);

    if (!user) {

      return {

        ok: false,

        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),

      };

    }

    return { ok: true, user };

  } catch (error) {

    const guarded = authGuardResponse(error);

    if (guarded) {

      return { ok: false, response: guarded };

    }

    throw error;

  }

}



/** Session-authenticated Supabase user with MFA AAL2 enforced. */

export async function getAuthenticatedSupabaseUser(

  supabase: Awaited<ReturnType<typeof createClient>>

) {

  const {

    data: { user },

  } = await supabase.auth.getUser();



  if (!user) return null;



  await assertMfaAal2Satisfied(supabase);

  return user;

}


