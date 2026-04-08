import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS } from "@/lib/project-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/app/actions/projects";
import { PROJECT_STATUS_ORDER } from "@/lib/project-status";

type StoreOption = { id: string; name: string };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const projects: {
    id: string;
    title: string;
    status: keyof typeof PROJECT_STATUS_LABELS;
    start_at: string | null;
    stores: {
      name: string;
      agencies: { name: string; carriers: { name: string } | null } | null;
    } | null;
  }[] = [];
  let stores: StoreOption[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [projRes, storeRes] = await Promise.all([
      supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          start_at,
          stores (
            name,
            agencies (
              name,
              carriers ( name )
            )
          )
        `
        )
        .order("start_at", { ascending: false, nullsFirst: false }),
      supabase.from("stores").select("id, name").order("name"),
    ]);
    projects.push(
      ...((projRes.data ?? []) as unknown as (typeof projects)[number][])
    );
    stores = (storeRes.data ?? []) as StoreOption[];
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">案件</h1>
          <p className="text-sm text-muted-foreground">
            ステータスと現場を紐付けて管理します。
          </p>
        </div>
      </div>

      {sp.error && (
        <p className="text-sm text-destructive">
          保存に失敗しました: {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規案件</CardTitle>
          <CardDescription>
            初期版は必須項目のみ。添付・収支は案件詳細から追加できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProject} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="title">案件名</Label>
              <Input id="title" name="title" required placeholder="例: 〇〇店 春のキャンペーン" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_id">現場（店舗）</Label>
              <select
                id="store_id"
                name="store_id"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                defaultValue=""
              >
                <option value="">未選択（後から紐付け可）</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">ステータス</Label>
                <select
                  id="status"
                  name="status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  defaultValue="proposal"
                >
                  {PROJECT_STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {PROJECT_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_at">開始</Label>
                <Input id="start_at" name="start_at" type="datetime-local" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_at">終了</Label>
              <Input id="end_at" name="end_at" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">メモ</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <Button type="submit" disabled={!isSupabaseConfigured()}>
              作成
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">一覧</h2>
        {!isSupabaseConfigured() && (
          <p className="text-sm text-muted-foreground">
            Supabase 接続後に一覧が表示されます。
          </p>
        )}
        {isSupabaseConfigured() && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">案件がありません。</p>
        )}
        <div className="grid gap-3">
          {projects.map((p) => {
            const place =
              p.stores?.name &&
              `${p.stores.agencies?.carriers?.name ?? ""} ${p.stores.agencies?.name ?? ""} ${p.stores.name}`
                .replace(/\s+/g, " ")
                .trim();
            return (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
                <Card className="transition-colors hover:bg-accent/30">
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{p.title}</p>
                      {place && (
                        <p className="truncate text-xs text-muted-foreground">
                          {place}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 sm:ml-4">
                      {PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
