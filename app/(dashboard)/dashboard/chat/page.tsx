import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantChatClient } from "@/components/tenant-chat-client";
import type { TenantChatMessage } from "@/lib/types/database";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isAnfraHost } from "@/lib/anfra-host";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) notFound();

  const anfraDarkShell = await isAnfraHost();

  const { data: rows } = await supabase
    .from("tenant_chat_messages")
    .select("id, author_id, author_display_name, body, created_at")
    .order("created_at", { ascending: true })
    .limit(200);

  const err = sp.error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquare className="h-7 w-7" aria-hidden />
          社内チャット
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          同じ会社のメンバーだけが閲覧・投稿できます。
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err === "empty" && "メッセージを入力してください。"}
          {err === "send" && "送信に失敗しました。"}
          {err === "delete" && "削除に失敗しました。"}
          {err === "invalid" && "操作が無効です。"}
        </p>
      )}

      <Card className={anfraDarkShell ? "border-zinc-800 bg-zinc-950/40" : undefined}>
        <CardHeader>
          <CardTitle>タイムライン</CardTitle>
          <CardDescription>
            直近 200 件を表示します。他テナントのユーザーとは共有されません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantChatClient
            initialMessages={(rows ?? []) as Pick<
              TenantChatMessage,
              "id" | "author_id" | "author_display_name" | "body" | "created_at"
            >[]}
            currentUserId={profile.id}
            anfraDarkShell={anfraDarkShell}
          />
        </CardContent>
      </Card>
    </div>
  );
}
