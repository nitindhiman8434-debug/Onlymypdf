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

function applyGuestSessionCookie(request: NextRequest, response: NextResponse) {
  if (!request.cookies.get(GUEST_SESSION_COOKIE)?.value) {
    response.cookies.set(GUEST_SESSION_COOKIE, crypto.randomUUID(), {
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

  if (originalPath.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-store");
    applyGuestSessionCookie(request, response);
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV === "production";
  const csp = buildContentSecurityPolicy(nonce, isProd);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the request CSP header and applies it to its
  // framework/hydration scripts, so 'strict-dynamic' actually protects them.
  requestHeaders.set("content-security-policy", csp);

  const isHindiRoute = pathnameHasHindiPrefix(originalPath);
  const pathname = isHindiRoute ? stripLocalePrefix(originalPath) : originalPath;
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

  let response: NextResponse;
  if (isHindiRoute) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname;
    response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    copyCookies(supabaseResponse, response);
    response.cookies.set(LOCALE_COOKIE, "hi", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.headers.set("x-locale", "hi");
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    copyCookies(supabaseResponse, response);
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    response.headers.set("x-locale", cookieLocale === "hi" ? "hi" : "en");
  }

  response.headers.set("x-pathname", pathname);

  applyGuestSessionCookie(request, response);

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
