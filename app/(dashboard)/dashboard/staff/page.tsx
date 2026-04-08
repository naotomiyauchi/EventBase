import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">スタッフ</h1>
          <p className="text-sm text-muted-foreground">
            一覧とスキル編集。プロフィール・権限の登録・変更は「設定」→「スタッフ名簿」から行います。
          </p>
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

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">一覧</h2>
          <form method="get" className="flex w-full max-w-sm gap-2">
            <Input
              name="q"
              placeholder="名前・ふりがな（メール・電話でも検索可）"
              defaultValue={qRaw}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" size="sm">
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
        <div className="grid gap-3">
          {rows.map((r) => {
            const skillList = r.skills ?? [];
            return (
              <Link key={r.id} href={`/dashboard/staff/${r.id}`}>
                <Card className="transition-colors hover:bg-accent/30">
                  <CardContent className="flex items-start gap-3 p-4">
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
                          <span className="text-xs text-muted-foreground">
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
