import Link from "next/link";
import { List, Plus, MapPin } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { deleteProject, updateProjectStatus } from "@/app/actions/projects";
import { PROJECT_STATUS_ORDER } from "@/lib/project-status";
import { StoresPageClient, type StoreRow } from "@/components/stores-page-client";
import { ProjectCreateForm } from "@/components/project-create-form";

type CarrierOption = { id: string; name: string };
type AgencyOption = {
  id: string;
  name: string;
  carriers: { name: string } | null;
  agency_carriers: { carrier_id: string }[] | null;
};
type StaffOption = { id: string; name: string };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    error?: string;
    deleted?: string;
    event_created?: string;
    event_updated?: string;
    event_deleted?: string;
    event_error?: string;
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const activeTab =
    sp.tab === "project-create" || sp.tab === "event-create" ? sp.tab : "projects-list";
  const projects: {
    id: string;
    title: string;
    status: keyof typeof PROJECT_STATUS_LABELS;
    event_location: string | null;
    stores: {
      name: string;
      agencies: { name: string; carriers: { name: string } | null } | null;
    } | null;
  }[] = [];
  let storeRows: StoreRow[] = [];
  let agencies: AgencyOption[] = [];
  let carriers: CarrierOption[] = [];
  let staffs: StaffOption[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [projRes, storeMasterRes, agencyRes, carrierRes, staffRes] = await Promise.all([
      supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          event_location,
          stores (
            name,
            agencies (
              name,
              carriers ( name )
            )
          )
        `
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("stores")
        .select(
          `
          id,
          agency_id,
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
        `
        )
        .order("name"),
      supabase
        .from("agencies")
        .select("id, name, carriers ( name ), agency_carriers ( carrier_id )")
        .order("name"),
      supabase.from("carriers").select("id, name").order("name"),
      supabase.from("staff").select("id, name").order("name"),
    ]);
    projects.push(
      ...((projRes.data ?? []) as unknown as (typeof projects)[number][])
    );
    storeRows = (storeMasterRes.data ?? []) as unknown as StoreRow[];
    agencies = (agencyRes.data ?? []) as unknown as AgencyOption[];
    carriers = (carrierRes.data ?? []) as CarrierOption[];
    staffs = (staffRes.data ?? []) as StaffOption[];
  }

  return (
    <div className="space-y-6">
      {sp.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          保存に失敗しました: {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.created === "1" && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          案件を登録しました。
        </p>
      )}
      {sp.deleted === "1" && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          案件を削除しました。
        </p>
      )}
      {sp.event_created === "1" && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          イベントを登録しました。
        </p>
      )}
      {sp.event_updated === "1" && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          イベントを更新しました。
        </p>
      )}
      {sp.event_deleted === "1" && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          イベントを削除しました。
        </p>
      )}
      {sp.event_error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          イベント操作に失敗しました: {decodeURIComponent(sp.event_error)}
        </p>
      )}

      <Card className="rounded-2xl border bg-linear-to-b from-card to-card/60 shadow-xs">
        <CardHeader className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              PROJECT STUDIO
            </p>
            <h1 className="text-xl font-semibold tracking-tight">案件情報</h1>
            <p className="text-sm text-muted-foreground">
              案件一覧・案件追加・イベント場所追加を1画面で管理します。
            </p>
          </div>
          <nav className="grid w-full max-w-xl gap-2 rounded-xl border bg-card/70 p-2 sm:grid-cols-3">
            {[
              { key: "projects-list", label: "案件一覧", icon: List },
              { key: "project-create", label: "案件の追加", icon: Plus },
              { key: "event-create", label: "イベント場所の追加", icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={`/dashboard/projects?tab=${tab.key}`}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </CardHeader>
      </Card>
      {activeTab === "projects-list" && (
        <div className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">案件一覧（編集・削除）</CardTitle>
              <CardDescription>
                ステータス変更と詳細編集をすばやく行えます。
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    p.event_location ||
                    (p.stores?.name &&
                      `${p.stores.agencies?.carriers?.name ?? ""} ${p.stores.agencies?.name ?? ""} ${p.stores.name}`
                        .replace(/\s+/g, " ")
                        .trim());
                  return (
                    <Card key={p.id} className="border-border/70 bg-card/70">
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium">{p.title}</p>
                            {place ? (
                              <p className="truncate text-xs text-muted-foreground">{place}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">開催場所未設定</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/projects/${p.id}`}>
                              <Button size="sm" variant="outline">
                                編集
                              </Button>
                            </Link>
                            <form action={deleteProject}>
                              <input type="hidden" name="id" value={p.id} />
                              <Button size="sm" variant="destructive" type="submit">
                                削除
                              </Button>
                            </form>
                          </div>
                        </div>
                        <form action={updateProjectStatus} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <select
                            name="status"
                            defaultValue={p.status}
                            className="flex h-9 min-w-44 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          >
                            {PROJECT_STATUS_ORDER.map((st) => (
                              <option key={st} value={st}>
                                {PROJECT_STATUS_LABELS[st]}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="secondary">
                            ステータス更新
                          </Button>
                          <Badge variant="secondary">{PROJECT_STATUS_LABELS[p.status]}</Badge>
                        </form>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "project-create" && (
        <div className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">案件の追加</CardTitle>
              <CardDescription>
                項目を3ブロックに整理し、迷わず入力できるようにしています。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectCreateForm
                stores={storeRows.map((s) => ({
                  id: s.id,
                  name: s.name,
                  agency_id: s.agency_id,
                }))}
                staffs={staffs}
                carriers={carriers}
                agencies={agencies.map((a) => ({
                  id: a.id,
                  name: a.name,
                  carrierIds:
                    a.agency_carriers?.map((c) => c.carrier_id).filter(Boolean) ?? [],
                }))}
                isSupabaseReady={isSupabaseConfigured()}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "event-create" && (
        <div className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">イベント場所の追加</CardTitle>
              <CardDescription>
                旧イベントタブ機能をここに統合しています。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isSupabaseConfigured() ? (
                <p className="text-sm text-muted-foreground">Supabase 接続後に表示されます。</p>
              ) : (
                <StoresPageClient
                  stores={storeRows}
                  agencies={agencies.map((a) => ({
                    id: a.id,
                    name: a.name,
                    carrierName: a.carriers?.name ?? null,
                  }))}
                  canMutate
                  returnTo="projects"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
