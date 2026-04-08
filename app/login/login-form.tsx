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
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Image
            src="/eventbase-logo.png"
            alt="EventBase"
            width={72}
            height={72}
            className="rounded"
            style={{ width: "auto", height: "auto" }}
          />
          <div>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>EventBase</CardDescription>
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
            Google でログイン（スプレッドシート連携用）
          </GoogleSheetsOAuthButton>
          <p className="text-center text-xs text-muted-foreground">または</p>
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
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "処理中…" : "ログイン"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          ログイン用アカウントの新規作成は、管理者またはチームリーダーが「設定」の「スタッフ名簿」から行います。
        </p>
      </CardContent>
    </Card>
  );
}
