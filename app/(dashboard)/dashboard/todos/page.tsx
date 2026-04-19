import { notFound } from "next/navigation";
import { ListTodo } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantTodosClient } from "@/components/tenant-todos-client";
import type { TenantTodo } from "@/lib/types/database";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isAnfraHost } from "@/lib/anfra-host";

type DirectoryRow = { id: string; display_name: string };

export default async function TodosPage({
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

  const [{ data: todoRows }, { data: dirRows, error: dirError }] = await Promise.all([
    supabase
      .from("tenant_todos")
      .select("id, owner_id, created_by, title, done, visibility, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.rpc("tenant_profile_directory"),
  ]);

  const directory: DirectoryRow[] = !dirError && Array.isArray(dirRows)
    ? (dirRows as DirectoryRow[])
    : [{ id: profile.id, display_name: "自分" }];

  const err = sp.error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ListTodo className="h-7 w-7" aria-hidden />
          ToDo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          プライベートは本人だけ。パブリックは同じ会社のメンバー全員が見られ、他人の分にも追加できます。
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err === "invalid" && "入力内容を確認してください。"}
          {err === "create" && "追加に失敗しました。"}
          {err === "update" && "更新に失敗しました。"}
          {err === "delete" && "削除に失敗しました。"}
        </p>
      )}

      {dirError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          メンバー一覧の取得に失敗しました。宛先は自分のみ選べます。
        </p>
      )}

      <Card className={anfraDarkShell ? "border-zinc-800 bg-zinc-950/40" : undefined}>
        <CardHeader>
          <CardTitle>リスト</CardTitle>
          <CardDescription>
            パブリックで他人のリストに追加した項目は、相手とあなた（作成者）が編集・削除できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantTodosClient
            initialTodos={(todoRows ?? []) as Pick<
              TenantTodo,
              "id" | "owner_id" | "created_by" | "title" | "done" | "visibility" | "created_at"
            >[]}
            directory={directory}
            currentUserId={profile.id}
            anfraDarkShell={anfraDarkShell}
          />
        </CardContent>
      </Card>
    </div>
  );
}
