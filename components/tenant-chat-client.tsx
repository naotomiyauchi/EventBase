"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteChatMessageAction, sendChatMessageAction } from "@/app/actions/chat";

export type ChatMessageRow = {
  id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

type Props = {
  initialMessages: ChatMessageRow[];
  currentUserId: string;
  anfraDarkShell?: boolean;
};

function dt(s: string) {
  return new Date(s).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function TenantChatClient({
  initialMessages,
  currentUserId,
  anfraDarkShell = false,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState(initialMessages);
  const [pending, setPending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tenant_chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tenant_chat_messages" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const id = String(row.id ?? "");
          const author_id = String(row.author_id ?? "");
          const author_display_name = String(row.author_display_name ?? "メンバー");
          const body = String(row.body ?? "");
          const created_at = String(row.created_at ?? new Date().toISOString());
          if (!id || !body) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev;
            return [...prev, { id, author_id, author_display_name, body, created_at }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    if (!body || pending) return;
    setPending(true);
    try {
      const form = new FormData();
      form.set("body", body);
      await sendChatMessageAction(form);
      (e.currentTarget as HTMLFormElement).reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "max-h-[min(60vh,520px)] space-y-3 overflow-y-auto rounded-xl border p-4",
          anfraDarkShell ? "border-zinc-800 bg-zinc-950/80" : "border-border bg-muted/30"
        )}
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            まだメッセージがありません。同じ会社のメンバーと会話を始められます。
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? anfraDarkShell
                        ? "bg-zinc-700 text-white"
                        : "bg-primary text-primary-foreground"
                      : anfraDarkShell
                        ? "bg-zinc-800 text-zinc-100"
                        : "bg-background text-foreground shadow-sm"
                  )}
                >
                  {!mine && (
                    <div className="mb-1 text-xs font-medium opacity-80">
                      {m.author_display_name}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-70">
                    <span>{dt(m.created_at)}</span>
                    {mine && (
                      <form action={deleteChatMessageAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="underline-offset-2 hover:underline"
                        >
                          削除
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <textarea
          name="body"
          rows={2}
          placeholder="メッセージを入力…"
          className={cn(
            "min-h-[44px] flex-1 resize-y rounded-xl border bg-background px-3 py-2 text-sm",
            anfraDarkShell && "border-zinc-700 bg-zinc-900 text-zinc-100"
          )}
          disabled={pending}
        />
        <Button type="submit" disabled={pending} className="shrink-0 sm:self-end">
          {pending ? "送信中…" : "送信"}
        </Button>
      </form>
    </div>
  );
}
