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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ProjectFileUpload } from "@/components/project-file-upload";
import { deleteProject, updateProject } from "@/app/actions/projects";

function toTimeOnly(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [{ data: project, error }, { data: staffOptions }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        id,
        title,
        status,
        store_id,
        assigned_staff_ids,
        overview,
        event_period_start,
        event_period_end,
        event_start_at,
        event_end_at,
        event_location,
        event_location_map_url,
        event_contact_name,
        event_contact_phone,
        event_notes,
        related_entities,
        direct_supervisor_entity,
        billing_target_entity,
        compensation_type,
        brokerage_rate,
        brokerage_notes,
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
      .maybeSingle(),
    supabase.from("staff").select("id, name").order("name"),
  ]);

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
  const assignedStaffIds = ((project as { assigned_staff_ids?: string[] | null }).assigned_staff_ids ??
    []) as string[];

  return (
    <div className="space-y-6">
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.updated === "project" && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          案件情報を更新しました。
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
          <CardTitle className="text-base">案件情報編集</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProject} className="space-y-6">
            <input type="hidden" name="id" value={project.id} />
            <div className="space-y-2">
              <Label htmlFor="title">案件名</Label>
              <Input id="title" name="title" required defaultValue={project.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overview">概要（説明）</Label>
              <Textarea id="overview" name="overview" rows={3} defaultValue={project.overview ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>担当スタッフ</Label>
              <div className="grid gap-2 rounded-xl border bg-card/40 p-3 sm:grid-cols-2">
                {(staffOptions ?? []).map((staff) => (
                  <label
                    key={staff.id}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="assigned_staff_ids"
                      value={staff.id}
                      defaultChecked={assignedStaffIds.includes(staff.id)}
                    />
                    <span>{staff.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">ステータス</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  {PROJECT_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_id">主要イベント開催場所（既存マスタ）</Label>
                <input type="hidden" name="store_id" value={project.store_id ?? ""} />
                <Input id="store_id" value={st?.name ?? "未設定"} readOnly />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_period_start">期間（開始日）</Label>
                <Input
                  id="event_period_start"
                  name="event_period_start"
                  type="date"
                  defaultValue={project.event_period_start ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_period_end">期間（終了日）</Label>
                <Input
                  id="event_period_end"
                  name="event_period_end"
                  type="date"
                  defaultValue={project.event_period_end ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_start_time">稼働開始時刻</Label>
                <Input
                  id="event_start_time"
                  name="event_start_time"
                  type="time"
                  defaultValue={toTimeOnly(project.event_start_at)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_end_time">稼働終了時刻</Label>
                <Input
                  id="event_end_time"
                  name="event_end_time"
                  type="time"
                  defaultValue={toTimeOnly(project.event_end_at)}
                />
              </div>
            </div>
            <input type="hidden" name="event_location" value={project.event_location ?? ""} />
            <input
              type="hidden"
              name="event_location_map_url"
              value={project.event_location_map_url ?? ""}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_contact_name">イベント場所の担当者</Label>
                <Input
                  id="event_contact_name"
                  name="event_contact_name"
                  defaultValue={project.event_contact_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_contact_phone">電話番号</Label>
                <Input
                  id="event_contact_phone"
                  name="event_contact_phone"
                  defaultValue={project.event_contact_phone ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_notes">イベント場所の注意事項</Label>
              <Textarea
                id="event_notes"
                name="event_notes"
                rows={3}
                defaultValue={project.event_notes ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="related_entities">案件に関わる会社や店舗</Label>
              <Textarea
                id="related_entities"
                name="related_entities"
                rows={2}
                defaultValue={project.related_entities ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="direct_supervisor_entity">直属の上司に当たる会社</Label>
                <Input
                  id="direct_supervisor_entity"
                  name="direct_supervisor_entity"
                  defaultValue={project.direct_supervisor_entity ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_target_entity">請求や見積もりを出す会社</Label>
                <Input
                  id="billing_target_entity"
                  name="billing_target_entity"
                  defaultValue={project.billing_target_entity ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="compensation_type">案件の報酬形態</Label>
                <select
                  id="compensation_type"
                  name="compensation_type"
                  defaultValue={project.compensation_type ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">未設定</option>
                  <option value="daily">日当</option>
                  <option value="commission">歩合</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brokerage_rate">中抜き率（%）</Label>
                <Input
                  id="brokerage_rate"
                  name="brokerage_rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={project.brokerage_rate ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brokerage_notes">報酬補足</Label>
              <Textarea
                id="brokerage_notes"
                name="brokerage_notes"
                rows={2}
                defaultValue={project.brokerage_notes ?? ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">保存</Button>
            </div>
          </form>
          <form action={deleteProject} className="mt-3">
            <input type="hidden" name="id" value={project.id} />
            <Button type="submit" variant="destructive">
              この案件を削除
            </Button>
          </form>
        </CardContent>
      </Card>

      {st && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">イベント</CardTitle>
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
              href="/dashboard/projects"
              className="mt-2 inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              案件タブでイベント管理
            </Link>
          </CardContent>
        </Card>
      )}

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
