import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
} from "@/lib/project-status";
import type { ProjectStatus } from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ProjectFileUpload } from "@/components/project-file-upload";
import { updateProjectNotes, updateProjectStatus } from "@/app/actions/projects";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Supabase を設定すると案件詳細を表示できます。
        </p>
        <Link
          href="/dashboard/projects"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          一覧へ
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      status,
      start_at,
      end_at,
      notes,
      stores (
        id,
        name,
        address,
        access_notes,
        contact_name,
        contact_phone,
        entry_rules,
        agencies (
          name,
          carriers ( name )
        )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !project) {
    notFound();
  }

  const { data: attachments } = await supabase
    .from("project_attachments")
    .select("id, original_name, file_path, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const st = project.stores as unknown as {
    id: string;
    name: string;
    address: string | null;
    access_notes: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    entry_rules: string | null;
    agencies: {
      name: string;
      carriers: { name: string } | null;
    } | null;
  } | null;

  const status = project.status as ProjectStatus;

  return (
    <div className="space-y-6">
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.updated === "status" && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          ステータスを更新しました。
        </p>
      )}
      {sp.updated === "notes" && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          メモを保存しました。
        </p>
      )}
      <div className="space-y-1">
        <Link
          href="/dashboard/projects"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← 案件一覧
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
          <Badge>{PROJECT_STATUS_LABELS[status]}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ステータス</CardTitle>
          <CardDescription>案件ステータスを更新します。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProjectStatus} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={project.id} />
            <div className="space-y-2">
              <Label htmlFor="status">状態</Label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="flex h-9 min-w-[12rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {PROJECT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">更新</Button>
          </form>
        </CardContent>
      </Card>

      {st && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">現場</CardTitle>
            <CardDescription>
              {st.agencies?.carriers?.name} {st.agencies?.name} / {st.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {st.address && (
              <p>
                <span className="text-muted-foreground">住所: </span>
                {st.address}
              </p>
            )}
            {st.access_notes && (
              <p>
                <span className="text-muted-foreground">アクセス: </span>
                {st.access_notes}
              </p>
            )}
            {(st.contact_name || st.contact_phone) && (
              <p>
                <span className="text-muted-foreground">担当: </span>
                {[st.contact_name, st.contact_phone].filter(Boolean).join(" / ")}
              </p>
            )}
            {st.entry_rules && (
              <p>
                <span className="text-muted-foreground">入館: </span>
                {st.entry_rules}
              </p>
            )}
            <Link
              href="/dashboard/stores"
              className="mt-2 inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              現場マスタ一覧
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">メモ</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProjectNotes} className="space-y-3">
            <input type="hidden" name="id" value={project.id} />
            <Textarea
              name="notes"
              rows={5}
              defaultValue={project.notes ?? ""}
              placeholder="共有メモ（初期版）"
            />
            <Button type="submit" size="sm">
              保存
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">添付ファイル</CardTitle>
          <CardDescription>レイアウト・実施要領書など</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProjectFileUpload projectId={project.id} />
          <Separator />
          <ul className="space-y-2 text-sm">
            {(attachments ?? []).length === 0 && (
              <li className="text-muted-foreground">添付はまだありません。</li>
            )}
            {(attachments ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {a.original_name ?? a.file_path}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
