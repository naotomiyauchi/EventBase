import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeHostname } from "@/lib/anfra-host";
import { updateSession } from "@/lib/supabase/middleware";

const FEATURE_OFF_HOSTS = new Set(["event-base.app", "www.event-base.app"]);

export async function middleware(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  const hostname = normalizeHostname(host);
  const featureOff = FEATURE_OFF_HOSTS.has(hostname);

  if (featureOff) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error:
            "This environment is temporarily disabled. Use localhost or anfra.jp hostnames for active features.",
        },
        { status: 503 }
      );
    }
    if (!pathname.startsWith("/maintenance")) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = "/maintenance";
      rewriteUrl.search = "";
      return NextResponse.rewrite(rewriteUrl);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /** manifest.json は PWA が未取得ログイン時も取得する。除外しないと /login?next=%2Fmanifest.json になる */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
