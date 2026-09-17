/**
 * Pure constant with no server-only imports so it can be safely referenced from
 * client components (e.g. login flash messages) without pulling `next/headers`
 * into the browser bundle.
 */
export const BLOCKED_LOGIN_MESSAGE =
  "Your account has been suspended. Contact support for help.";
