import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isLocalDevAuthEnabled } from "@/lib/auth/auth-config";
import { getLocalDevUserIdFromRequestEdge } from "@/lib/auth/local-dev-session-edge";
import { GUEST_SESSION_COOKIE } from "@/lib/privacy/guest-session";
import {
  LOCALE_COOKIE,
  pathnameHasHindiPrefix,
  stripLocalePrefix,
} from "@/lib/i18n/locale-path";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

const PROTECTED_ROUTES = ["/dashboard", "/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

function resolveGuestSession(request: NextRequest): {
  id: string;
  created: boolean;
} {
  const existing = request.cookies.get(GUEST_SESSION_COOKIE)?.value?.trim();
  return existing
    ? { id: existing, created: false }
    : { id: crypto.randomUUID(), created: true };
}

function forwardGuestSession(headers: Headers, session: { id: string; created: boolean }) {
  if (!session.created) return;
  const current = headers.get("cookie")?.trim();
  headers.set(
    "cookie",
    `${current ? `${current}; ` : ""}${GUEST_SESSION_COOKIE}=${session.id}`
  );
}

function applyGuestSessionCookie(
  response: NextResponse,
  session: { id: string; created: boolean }
) {
  if (session.created) {
    response.cookies.set(GUEST_SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}

export async function middleware(request: NextRequest) {
  const originalPath = request.nextUrl.pathname;
  const guestSession = resolveGuestSession(request);

  if (originalPath === "/api" || originalPath.startsWith("/api/")) {
    const apiRequestHeaders = new Headers(request.headers);
    forwardGuestSession(apiRequestHeaders, guestSession);
    const response = NextResponse.next({ request: { headers: apiRequestHeaders } });
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-store");
    applyGuestSessionCookie(response, guestSession);
    return response;
  }

  // Retired public language URLs keep their bookmarks/search traffic, without
  // authenticating or rendering a second version of the site first.
  if (pathnameHasHindiPrefix(originalPath)) {
    const englishUrl = request.nextUrl.clone();
    englishUrl.pathname = stripLocalePrefix(originalPath);
    // A locale prefix must not provide another way to call an API endpoint.
    if (englishUrl.pathname === "/api" || englishUrl.pathname.startsWith("/api/")) {
      return new NextResponse(null, { status: 404 });
    }
    englishUrl.searchParams.delete("lang");
    const response = NextResponse.redirect(englishUrl, 308);
    if (request.cookies.has(LOCALE_COOKIE)) response.cookies.delete(LOCALE_COOKIE);
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV === "production";
  const csp = buildContentSecurityPolicy(nonce, isProd);
  const requestHeaders = new Headers(request.headers);
  forwardGuestSession(requestHeaders, guestSession);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-locale", "en");
  // Next.js reads the nonce from the request CSP header and applies it to its
  // framework/hydration scripts, so 'strict-dynamic' actually protects them.
  requestHeaders.set("content-security-policy", csp);

  const pathname = originalPath;
  const isAdminRoute = pathname.startsWith("/admin");

  const { supabaseResponse, user: supabaseUser, profileRole, profileBlocked, mfaVerificationRequired } =
    await updateSession(request, {
      loadProfileRole: isAdminRoute,
      loadProfileFlags: true,
    });

  const localDevUserId = isLocalDevAuthEnabled()
    ? await getLocalDevUserIdFromRequestEdge(request)
    : null;
  const isAuthenticated = !!supabaseUser || !!localDevUserId;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && isAuthenticated && mfaVerificationRequired) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", originalPath);
    loginUrl.searchParams.set("step", "mfa");
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", originalPath);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isAuthenticated &&
    profileBlocked &&
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/account-suspended")
  ) {
    return NextResponse.redirect(new URL("/account-suspended", request.url));
  }

  if (isAdminRoute && isAuthenticated) {
    const isAdmin =
      profileRole === "admin" ||
      (isLocalDevAuthEnabled() && !!localDevUserId);
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (isAuthRoute && isAuthenticated && !mfaVerificationRequired) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  copyCookies(supabaseResponse, response);
  if (request.cookies.has(LOCALE_COOKIE)) response.cookies.delete(LOCALE_COOKIE);
  response.headers.set("x-locale", "en");

  response.headers.set("x-pathname", pathname);

  applyGuestSessionCookie(response, guestSession);

  // Enforce on the response; the nonce is NOT echoed as a standalone header so
  // it cannot be trivially read back if an XSS gadget exists.
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
