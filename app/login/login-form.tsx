"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSheetsOAuthButton } from "@/components/google-sheets-oauth-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LoginFormProps = {
  /** サーバーが URL の `next` から解決（useSearchParams を使わずハイドレーションを一致させる） */
  nextPath: string;
};

export function LoginForm({ nextPath: next }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const safeNext =
      next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    /** iOS Safari 等でクッキー確定前にクライアント遷移すると未ログイン扱いになることがあるためフルリロードする */
    window.location.assign(safeNext);
  }

  return (
    <Card className="w-full max-w-md border bg-background/70 shadow-lg backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Image
            src="/eventbase-logo.png"
            alt="EventBase"
            width={84}
            height={84}
            className="rounded-xl ring-1 ring-foreground/10"
            style={{ width: "auto", height: "auto" }}
          />
          <div>
            <CardTitle className="text-xl">ログイン</CardTitle>
            <CardDescription>
              管理者またはチームリーダーが発行したアカウントでログインします。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <GoogleSheetsOAuthButton
            mode="signIn"
            nextPath={next}
            variant="outline"
            className="w-full"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <svg
                aria-hidden="true"
                focusable="false"
                width="18"
                height="18"
                viewBox="0 0 48 48"
              >
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303C33.653 32.657 29.153 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.96 3.04l5.657-5.657C34.045 6.053 29.272 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.96 3.04l5.657-5.657C34.045 6.053 29.272 4 24 4c-7.682 0-14.354 4.327-17.694 10.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.074 0 9.768-1.94 13.29-5.09l-6.13-5.19C29.106 35.26 26.674 36 24 36c-5.132 0-9.62-3.317-11.283-7.946l-6.52 5.025C9.505 39.556 16.227 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303a12.03 12.03 0 0 1-4.143 5.72l.003-.002 6.13 5.19C36.836 39.327 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                />
              </svg>
              <span>Google でログイン</span>
            </span>
          </GoogleSheetsOAuthButton>
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <p className="text-xs text-muted-foreground">または</p>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {message && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "処理中…" : "ログイン"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          パスワードが不明な場合は管理者に再設定を依頼してください。
        </p>
      </CardContent>
    </Card>
  );
}
