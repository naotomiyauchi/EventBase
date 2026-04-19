import { NextRequest, NextResponse } from "next/server";
import { fetchStaffExportBundle } from "@/lib/fetch-staff-export-bundle";
import { getOAuth2WithRefreshToken } from "@/lib/google-oauth-client";
import { isGoogleSheetsApiConfigured } from "@/lib/google-sheets-config";
import { createStaffGoogleSpreadsheet } from "@/lib/google-staff-sheets";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isGoogleSheetsApiConfigured()) {
    const u = new URL(`/dashboard/staff/${id}`, request.nextUrl.origin);
    u.searchParams.set("google_export", "env");
    return NextResponse.redirect(u.toString());
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const u = new URL("/login", request.nextUrl.origin);
    u.searchParams.set("next", `/dashboard/staff/${id}`);
    return NextResponse.redirect(u.toString());
  }

  const bundle = await fetchStaffExportBundle(supabase, id);
  if (!bundle) {
    const u = new URL(`/dashboard/staff/${id}`, request.nextUrl.origin);
    u.searchParams.set("google_export", "not_found");
    return NextResponse.redirect(u.toString());
  }

  const { data: token, error: rpcErr } = await supabase.rpc(
    "get_google_refresh_token_for_export"
  );

  if (rpcErr) {
    console.error("[google export rpc]", rpcErr);
    const u = new URL(`/dashboard/staff/${id}`, request.nextUrl.origin);
    u.searchParams.set("google_export", "rpc");
    return NextResponse.redirect(u.toString());
  }

  const tokenStr =
    typeof token === "string"
      ? token
      : token != null
        ? String(token)
        : "";

  if (tokenStr.length > 0) {
    try {
      const oauth2 = getOAuth2WithRefreshToken(tokenStr);
      const { spreadsheetUrl } = await createStaffGoogleSpreadsheet(
        oauth2,
        bundle.record,
        bundle.history
      );
      return NextResponse.redirect(spreadsheetUrl);
    } catch (e) {
      console.error("[google export sheet]", e);
      const u = new URL(`/dashboard/staff/${id}`, request.nextUrl.origin);
      u.searchParams.set("connect_google", "1");
      u.searchParams.set("next", `/api/staff/${id}/export/google`);
      u.searchParams.set("google_export", "sheet_failed");
      return NextResponse.redirect(u.toString());
    }
  }

  const u = new URL(`/dashboard/staff/${id}`, request.nextUrl.origin);
  u.searchParams.set("connect_google", "1");
  u.searchParams.set("next", `/api/staff/${id}/export/google`);
  u.searchParams.set("google_export", "no_token");
  return NextResponse.redirect(u.toString());
}
