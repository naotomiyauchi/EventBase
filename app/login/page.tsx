import Link from "next/link";
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
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
