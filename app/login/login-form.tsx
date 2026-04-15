"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TenantLogo } from "@/components/tenant-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { GoogleSheetsOAuthButton } from "@/components/google-sheets-oauth-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TenantResolvePayload } from "@/lib/tenant-branding";
import { tenantPrimaryCssVars } from "@/lib/tenant-branding";

export type LoginFormProps = {
  nextPath: string;
  tenant?: TenantResolvePayload | null;
  /** anfra.jp 系 — ログインカードをダークに */
  anfraDark?: boolean;
  forceWhiteLogo?: boolean;
};

export function LoginForm({
  nextPath: next,
  tenant,
  anfraDark = false,
  forceWhiteLogo = false,
}: LoginFormProps) {
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
    window.location.assign(safeNext);
  }

  const loginTagline = tenant?.branding.loginTagline?.trim();

  return (
    <div
      className={cn("w-full max-w-[420px]", anfraDark && "text-zinc-100")}
      style={tenantPrimaryCssVars(tenant?.branding ?? {})}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border backdrop-blur-2xl",
          anfraDark
            ? [
                "border-zinc-700/80 bg-zinc-900/95",
                "shadow-[0_32px_64px_-16px_rgba(0,0,0,0.75)]",
              ]
            : [
                "border-border/50 bg-card/70",
                "shadow-[0_32px_64px_-16px_rgba(15,23,42,0.18)]",
                "dark:border-white/10 dark:bg-zinc-950/70",
                "dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.65)]",
              ]
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />

        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-6 pb-2 pt-10 text-center">
            <div className="mx-auto flex justify-center">
              <div
                className={cn(
                  "rounded-2xl p-3 shadow-inner ring-1",
                  anfraDark
                    ? "bg-linear-to-br from-zinc-800 to-zinc-900 ring-zinc-600"
                    : "bg-linear-to-br from-muted/80 to-muted/30 ring-border/60 dark:from-white/10 dark:to-white/5 dark:ring-white/10"
                )}
              >
                <TenantLogo
                  logoUrl={tenant?.branding.logoUrl}
                  width={88}
                  height={88}
                  className="rounded-xl"
                  forceWhiteLogo={forceWhiteLogo}
                />
              </div>
            </div>
            <div className="space-y-2 px-1">
              <h2
                className={cn(
                  "text-2xl font-semibold tracking-tight",
                  anfraDark ? "text-zinc-50" : "text-foreground"
                )}
              >
                おかえりなさい
              </h2>
              {loginTagline ? (
                <CardDescription
                  className={cn(
                    "text-pretty text-sm leading-relaxed",
                    anfraDark ? "text-zinc-400" : "text-muted-foreground"
                  )}
                >
                  {loginTagline}
                </CardDescription>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-8 px-6 pb-10 pt-2">
            <div className="space-y-3">
              <GoogleSheetsOAuthButton
                mode="signIn"
                nextPath={next}
                variant="outline"
                className={cn(
                  "h-11 w-full rounded-xl text-sm font-medium shadow-sm transition-all",
                  anfraDark
                    ? "border-zinc-600 bg-zinc-950/80 text-zinc-100 hover:bg-zinc-800 hover:shadow-md"
                    : [
                        "border-border/80 bg-background/80",
                        "hover:bg-muted/80 hover:shadow-md",
                        "dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
                      ]
                )}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
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
                  Google でログイン
                </span>
              </GoogleSheetsOAuthButton>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span
                    className={cn(
                      "w-full border-t",
                      anfraDark ? "border-zinc-700" : "border-border/60"
                    )}
                  />
                </div>
                <div className="relative flex justify-center text-xs font-medium uppercase tracking-wider">
                  <span
                    className={cn(
                      "px-3",
                      anfraDark
                        ? "bg-zinc-900/95 text-zinc-500"
                        : "bg-card/90 text-muted-foreground dark:bg-zinc-950/90"
                    )}
                  >
                    またはメールで
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn(
                    "text-xs font-medium",
                    anfraDark ? "text-zinc-400" : "text-muted-foreground"
                  )}
                >
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={cn(
                    "h-11 rounded-xl px-3.5 text-base",
                    anfraDark
                      ? "border-zinc-600 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                      : "border-border/80 bg-background/50 dark:bg-white/5"
                  )}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className={cn(
                    "text-xs font-medium",
                    anfraDark ? "text-zinc-400" : "text-muted-foreground"
                  )}
                >
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={cn(
                    "h-11 rounded-xl px-3.5 text-base",
                    anfraDark
                      ? "border-zinc-600 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                      : "border-border/80 bg-background/50 dark:bg-white/5"
                  )}
                  placeholder="••••••••"
                />
              </div>
              {message && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                >
                  {message}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "h-11 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/20",
                  "transition-all hover:shadow-xl hover:shadow-primary/25"
                )}
              >
                {loading ? "サインイン中…" : "サインイン"}
              </Button>
            </form>

            <p
              className={cn(
                "text-center text-xs leading-relaxed",
                anfraDark ? "text-zinc-500" : "text-muted-foreground"
              )}
            >
              パスワードをお忘れの場合は、管理者へ再設定を依頼してください。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
