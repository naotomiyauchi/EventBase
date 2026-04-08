import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * OAuth 完了後、Supabase セッションに含まれる Google の
 * provider_refresh_token を管理者・チームリーダー分だけ DB に保存する。
 * （Sheets API は同一クライアント ID でリフレッシュする）
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
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    const role = prof?.role as string | undefined;
    if (role === "admin" || role === "team_leader") {
      await supabase.from("user_google_credentials").upsert({
        user_id: session.user.id,
        google_refresh_token: refresh,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
