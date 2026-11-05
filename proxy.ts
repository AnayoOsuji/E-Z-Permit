// Next.js 16 renamed middleware.ts to proxy.ts; this is the session-refresh middleware.
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy.ts";

const PROTECTED = ["/dashboard", "/my-roadmaps", "/account"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    // Keep any refreshed auth cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  if (user && AUTH_PAGES.includes(pathname)) {
    return redirectTo("/dashboard");
  }
  return response;
}

export const config = {
  // Skip static files, the checklist API, the public guide pages and Paystack's webhook, which don't need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/checklist|api/paystack/webhook|permits|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
