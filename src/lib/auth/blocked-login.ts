import { createServiceClient } from "@/lib/supabase/server";
import { isBlockedProfile } from "@/lib/auth/plan-access";

export { BLOCKED_LOGIN_MESSAGE } from "@/lib/auth/blocked-login-message";

export async function isUserLoginBlocked(userId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("is_blocked")
      .eq("id", userId)
      .maybeSingle();
    if (error) return true;
    if (!data) return false;
    return isBlockedProfile(data);
  } catch {
    return true;
  }
}
