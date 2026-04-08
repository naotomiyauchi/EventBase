import Link from "next/link";
import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/env";
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
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-background via-background to-muted" />
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <Image
            src="/eventbase-logo.png"
            alt=""
            width={900}
            height={900}
            priority
            className="opacity-[0.01] blur-sm"
            style={{ width: "min(70vw, 520px)", height: "auto" }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-size-[48px_48px] opacity-[0.35]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-80 w-240 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-[-10%] -z-10 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-400/10" />
        <div className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Supabase が未設定です</CardTitle>
            <CardDescription>
              プロジェクトルートに{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                .env.local
              </code>{" "}
              を作成し、次を設定してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-muted-foreground">
            <p>NEXT_PUBLIC_SUPABASE_URL=...</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
            <p className="pt-2 font-sans text-sm">
              SQL は{" "}
              <code className="rounded bg-muted px-1">supabase/migrations/</code>{" "}
              を Supabase SQL Editor で実行してください。
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex h-8 w-full items-center justify-center rounded-lg border border-transparent bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              設定なしで画面だけ見る
            </Link>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-background via-background to-muted" />
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <Image
          src="/eventbase-logo.png"
          alt=""
          width={1100}
          height={1100}
          priority
          className="opacity-[0.03] blur-sm"
          style={{ width: "min(75vw, 620px)", height: "auto" }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-size-[56px_56px] opacity-[0.30]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-240 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 left-[-10%] -z-10 h-112 w-md rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-400/10" />
      <div className="pointer-events-none absolute -bottom-40 right-[-10%] -z-10 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-400/10" />
      <div className="mx-auto grid min-h-svh max-w-6xl grid-cols-1 items-center gap-8 p-6 lg:grid-cols-2 lg:gap-10">
        <div className="hidden lg:block">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              シフト・勤怠・案件を
              <span className="text-primary">ひとつ</span>に。
            </h1>
            <p className="text-sm text-muted-foreground">
              EventBase はイベント運用に必要な情報を集約し、打刻と実績入力までスムーズにします。
            </p>
            <div className="grid gap-3 pt-2 text-sm">
              <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur">
                <p className="font-medium">管理者</p>
                <p className="text-muted-foreground">
                  シフト表・全員カレンダー・本日の稼働状況を一目で把握。
                </p>
              </div>
              <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur">
                <p className="font-medium">スタッフ</p>
                <p className="text-muted-foreground">
                  出勤/退勤、実績/経費、希望休（NG日）を迷わず操作。
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ※ ログイン用アカウントの作成は管理者/チームリーダーが行います。
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end">
          <LoginForm nextPath={nextPath} />
        </div>
      </div>
    </div>
  );
}
