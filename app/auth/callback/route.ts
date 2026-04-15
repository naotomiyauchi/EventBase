import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * OAuth 完了後、Supabase セッションに含まれる Google の
 * provider_refresh_token を DB に保存する。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const session = data.session;
  const refresh = session.provider_refresh_token;

  if (refresh) {
    await supabase.from("user_google_credentials").upsert({
      user_id: session.user.id,
      google_refresh_token: refresh,
      updated_at: new Date().toISOString(),
    });

    const email = (session.user.email ?? "").trim().toLowerCase();
    if (email) {
      const [{ data: prof }, { data: staff }] = await Promise.all([
        supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("staff")
          .select("id, tenant_id, name, email")
          .ilike("email", email)
          .limit(1)
          .maybeSingle(),
      ]);
      const tenantId = staff?.tenant_id ?? prof?.tenant_id ?? null;
      if (tenantId) {
        const staffName = staff?.name ?? session.user.user_metadata?.display_name ?? "スタッフ";
        const targetEmail = (staff?.email ?? email).toLowerCase();
        await supabase.from("app_notifications").insert([
          {
            tenant_id: tenantId,
            type: "google_link_completed_manager",
            title: `${staffName}さんがGoogle連携を完了させました。`,
            body: null,
            metadata: {
              staff_name: staffName,
              target_email: targetEmail,
              target_staff_id: staff?.id ?? null,
            },
          },
          {
            tenant_id: tenantId,
            type: "google_link_completed_staff",
            title: "Google連携を完了させました。",
            body: null,
            metadata: {
              target_email: targetEmail,
              target_staff_id: staff?.id ?? null,
              staff_name: staffName,
            },
          },
        ]);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
