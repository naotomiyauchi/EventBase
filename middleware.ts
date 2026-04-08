import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /** manifest.json は PWA が未取得ログイン時も取得する。除外しないと /login?next=%2Fmanifest.json になる */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
