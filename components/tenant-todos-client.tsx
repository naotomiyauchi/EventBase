"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createTodoAction,
  deleteTodoAction,
  toggleTodoAction,
} from "@/app/actions/todos";

export type TodoRow = {
  id: string;
  owner_id: string;
  created_by: string;
  title: string;
  done: boolean;
  visibility: "private" | "public";
  created_at: string;
};

type DirectoryEntry = { id: string; display_name: string };

type Props = {
  initialTodos: TodoRow[];
  directory: DirectoryEntry[];
  currentUserId: string;
  anfraDarkShell?: boolean;
};

function nameMap(dir: DirectoryEntry[]) {
  return new Map(dir.map((d) => [d.id, d.display_name]));
}

export function TenantTodosClient({
  initialTodos,
  directory,
  currentUserId,
  anfraDarkShell = false,
}: Props) {
  const [tab, setTab] = React.useState<"private" | "public">("private");
  const names = React.useMemo(() => nameMap(directory), [directory]);

  const privateMine = React.useMemo(
    () =>
      initialTodos.filter(
        (t) => t.visibility === "private" && t.owner_id === currentUserId
      ),
    [initialTodos, currentUserId]
  );

  const publicAll = React.useMemo(
    () => initialTodos.filter((t) => t.visibility === "public"),
    [initialTodos]
  );

  const visible = tab === "private" ? privateMine : publicAll;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "inline-flex rounded-xl border p-1",
          anfraDarkShell ? "border-zinc-700 bg-zinc-900/80" : "border-border bg-muted/40"
        )}
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "private"}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "private"
              ? anfraDarkShell
                ? "bg-zinc-800 text-white"
                : "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("private")}
        >
          プライベート
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "public"}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "public"
              ? anfraDarkShell
                ? "bg-zinc-800 text-white"
                : "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("public")}
        >
          パブリック
        </button>
      </div>

      <section
        className={cn(
          "rounded-xl border p-4",
          anfraDarkShell ? "border-zinc-800 bg-zinc-950/60" : "border-border bg-card"
        )}
      >
        <h2 className="mb-3 text-sm font-semibold">
          {tab === "private" ? "自分だけが見られる ToDo" : "会社内で共有される ToDo"}
        </h2>
        <form action={createTodoAction} className="mb-4 flex flex-col gap-3">
          <input type="hidden" name="visibility" value={tab} />
          {tab === "public" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">宛先（誰のリストか）</span>
              <select
                name="owner_id"
                defaultValue={currentUserId}
                className={cn(
                  "rounded-lg border bg-background px-3 py-2 text-sm",
                  anfraDarkShell && "border-zinc-700 bg-zinc-900"
                )}
              >
                {directory.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_name}
                    {d.id === currentUserId ? "（自分）" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">内容</span>
            <input
              name="title"
              required
              placeholder="やること…"
              className={cn(
                "rounded-lg border bg-background px-3 py-2 text-sm",
                anfraDarkShell && "border-zinc-700 bg-zinc-900"
              )}
            />
          </label>
          <Button type="submit" size="sm" className="w-fit">
            追加
          </Button>
        </form>

        <ul className="space-y-2">
          {visible.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {tab === "private"
                ? "プライベートの ToDo はまだありません。"
                : "パブリックの ToDo はまだありません。"}
            </li>
          ) : (
            visible.map((t) => {
              const ownerLabel =
                t.owner_id === currentUserId
                  ? "自分"
                  : (names.get(t.owner_id) ?? "メンバー");
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                    anfraDarkShell ? "border-zinc-800" : "border-border"
                  )}
                >
                  <form action={toggleTodoAction} className="pt-0.5">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="done" value={t.done ? "false" : "true"} />
                    <button
                      type="submit"
                      aria-label={t.done ? "未完了に戻す" : "完了にする"}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        t.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {t.done ? "✓" : ""}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "whitespace-pre-wrap wrap-break-word",
                        t.done && "text-muted-foreground line-through"
                      )}
                    >
                      {t.title}
                    </p>
                    {tab === "public" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        宛先: {ownerLabel}
                        {t.created_by !== t.owner_id && (
                          <>
                            {" "}
                            · 追加: {names.get(t.created_by) ?? "メンバー"}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <form action={deleteTodoAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs">
                      削除
                    </Button>
                  </form>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
