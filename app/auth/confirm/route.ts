import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "../../../lib/auth.ts";
import { createClient } from "../../../lib/supabase/server.ts";

// Landing point for the "confirm your email" link. Handles both the PKCE `code`
// flow and the `token_hash` email template, then signs the user in.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  if (supabase) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : { error: new Error("Missing confirmation token") };
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=confirm", request.url));
}
