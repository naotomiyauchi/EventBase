import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Search, Users } from "lucide-react";

function sanitizeSearchQuery(q: string): string {
  return q.replace(/[%_\\]/g, "").slice(0, 80);
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const qRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const q = sanitizeSearchQuery(qRaw);

  type Row = {
    id: string;
    name: string;
    name_kana: string | null;
    skills: string[] | null;
  };
  let rows: Row[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    let query = supabase
      .from("staff")
      .select("id, name, name_kana, skills")
      .order("name");
    if (q.length > 0) {
      const pat = `%${q}%`;
      query = query.or(
        `name.ilike.${pat},name_kana.ilike.${pat},email.ilike.${pat},phone.ilike.${pat}`
      );
    }
    const { data } = await query;
    rows = (data ?? []) as Row[];
  }

  const withSkillsCount = rows.filter((r) => (r.skills ?? []).length > 0).length;
  const noSkillsCount = rows.length - withSkillsCount;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              STAFF STUDIO
            </p>
            <h1 className="text-xl font-semibold tracking-tight">スタッフ情報</h1>
            <p className="text-sm text-muted-foreground">
              一覧とスキル管理ができます。プロフィール・権限の登録や変更は「設定」→「スタッフ名簿」で行います。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="rounded-xl border bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">総スタッフ</p>
              <p className="text-base font-semibold">{rows.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">スキル登録済</p>
              <p className="text-base font-semibold">{withSkillsCount}</p>
            </div>
            <div className="rounded-xl border bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">未登録</p>
              <p className="text-base font-semibold">{noSkillsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {sp.created && (
        <p className="text-sm text-green-600 dark:text-green-400">
          スタッフを登録しました。
        </p>
      )}
      {sp.updated && (
        <p className="text-sm text-green-600 dark:text-green-400">
          保存しました。
        </p>
      )}
      {sp.deleted && (
        <p className="text-sm text-green-600 dark:text-green-400">
          削除しました。
        </p>
      )}
      {sp.error && (
        <p className="text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" />
              スタッフ一覧
            </h2>
            <p className="text-xs text-muted-foreground">
              名前・ふりがな・メール・電話番号で検索できます。
            </p>
          </div>
          <form method="get" className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="名前・ふりがな（メール・電話でも検索可）"
                defaultValue={qRaw}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="min-w-16">
              検索
            </Button>
          </form>
        </div>

        {!isSupabaseConfigured() && (
          <p className="text-sm text-muted-foreground">
            Supabase 接続後に表示されます。
          </p>
        )}
        {isSupabaseConfigured() && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {q.length > 0
              ? "該当するスタッフがありません。"
              : "スタッフがまだいません。管理者・チームリーダーは「設定」→「スタッフ（アカウント）の登録」から追加してください。"}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const skillList = r.skills ?? [];
            return (
              <Link key={r.id} href={`/dashboard/staff/${r.id}`}>
                <Card className="h-full border-border/80 bg-linear-to-br from-card to-card/80 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <CardContent className="flex h-full items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold leading-tight">
                            {r.name}
                          </p>
                          {r.name_kana && (
                            <p className="text-xs text-muted-foreground">
                              {r.name_kana}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skillList.length === 0 ? (
                          <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
                            スキル未登録
                          </span>
                        ) : (
                          skillList.map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="text-xs"
                            >
                              {s}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
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
