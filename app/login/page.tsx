import Link from "next/link";
import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantForHost } from "@/lib/tenant-resolve";
import { tenantPrimaryCssVars } from "@/lib/tenant-branding";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

function safeNextPath(raw: string | undefined): string {
  const n = (raw ?? "/dashboard").trim() || "/dashboard";
  if (n.startsWith("/") && !n.startsWith("//")) return n;
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const nextRaw =
    typeof sp.next === "string"
      ? sp.next
      : Array.isArray(sp.next)
        ? sp.next[0]
        : undefined;
  const nextPath = safeNextPath(nextRaw);

  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <div className="relative min-h-svh overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-background via-muted/40 to-muted" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <Image
            src="/eventbase-logo.png"
            alt=""
            width={900}
            height={900}
            priority
            className="opacity-[0.02] blur-sm"
            style={{ width: "min(70vw, 520px)", height: "auto" }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-size-[48px_48px] opacity-[0.25]" />
        <div className="flex min-h-svh flex-col items-center justify-center p-6">
          <Card className="w-full max-w-md rounded-3xl border-border/60 shadow-2xl shadow-black/5 backdrop-blur-xl dark:shadow-black/40">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold tracking-tight">
                Supabase が未設定です
              </CardTitle>
              <CardDescription>
                プロジェクトルートに{" "}
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                  .env.local
                </code>{" "}
                を作成し、次を設定してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-xs text-muted-foreground">
              <p>NEXT_PUBLIC_SUPABASE_URL=...</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
              <p className="pt-1 font-sans text-sm leading-relaxed">
                SQL は{" "}
                <code className="rounded-md bg-muted px-1.5 py-0.5">
                  supabase/migrations/
                </code>{" "}
                を Supabase SQL Editor で実行してください。
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
              >
                設定なしで画面だけ見る
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const tenant = await resolveTenantForHost(supabase);

  return (
    <div
      className="relative isolate min-h-svh overflow-hidden"
      style={tenantPrimaryCssVars(tenant?.branding ?? {})}
    >
      {/* 背景レイヤー */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-background via-muted/30 to-background" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,hsl(var(--primary)/0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.06),transparent_50%)]" />
      <div className="pointer-events-none absolute -left-1/4 top-1/4 -z-10 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
      <div className="pointer-events-none absolute -right-1/4 bottom-0 -z-10 h-[380px] w-[380px] rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-400/8" />

      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        {tenant?.branding.logoUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.branding.logoUrl.trim()}
            alt=""
            width={1100}
            height={1100}
            className="opacity-[0.025] blur-sm"
            style={{ width: "min(75vw, 620px)", height: "auto" }}
          />
        ) : (
          <Image
            src="/eventbase-logo.png"
            alt=""
            width={1100}
            height={1100}
            priority
            className="opacity-[0.025] blur-sm"
            style={{ width: "min(75vw, 620px)", height: "auto" }}
          />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-size-[64px_64px] opacity-[0.2] dark:opacity-[0.12]" />

      <div className="flex min-h-svh flex-col items-center justify-center px-5 py-12">
        <LoginForm nextPath={nextPath} tenant={tenant} />
      </div>
    </div>
  );
}
