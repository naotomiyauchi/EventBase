"use client";

import { createClient } from "@/lib/supabase/client";
import { GOOGLE_SHEETS_SCOPES } from "@/lib/google-oauth-scopes";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Props = {
  /** auth/callback 後の遷移先パス（例: /dashboard または /dashboard/settings/google） */
  nextPath: string;
  /** 未ログイン: Google でログイン。ログイン済み: Google アカウントを紐付け（要 Manual Linking） */
  mode: "signIn" | "link";
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

export function GoogleSheetsOAuthButton({
  nextPath,
  mode,
  children,
  variant = "secondary",
  size = "default",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const options = {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      } as Record<string, string>,
      scopes: GOOGLE_SHEETS_SCOPES,
    };

    if (mode === "link") {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options,
      });
      setLoading(false);
      if (error) setMsg(error.message);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options,
    });
    setLoading(false);
    if (error) setMsg(error.message);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={loading}
        onClick={onClick}
      >
        {loading ? "処理中…" : children}
      </Button>
      {msg && (
        <p className="text-xs text-destructive">{msg}</p>
      )}
    </div>
  );
}
