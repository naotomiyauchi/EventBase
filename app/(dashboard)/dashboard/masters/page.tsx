import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAgency, createCarrier } from "@/app/actions/agencies";
import { StoresPageClient, type StoreRow } from "@/components/stores-page-client";

export default async function MastersPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    error?: string;
    error_target?: string;
    store_created?: string;
    store_updated?: string;
    store_deleted?: string;
    store_error?: string;
  }>;
}) {
  const sp = await searchParams;

  type Carrier = { id: string; code: string; name: string };
  type Agency = {
    id: string;
    name: string;
    agency_carriers:
      | {
          carriers: {
            name: string;
          } | null;
        }[]
      | null;
  };
  let carriers: Carrier[] = [];
  let agencies: Agency[] = [];
  let stores: StoreRow[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [c, a, s] = await Promise.all([
      supabase.from("carriers").select("id, code, name").order("sort_order"),
      supabase
        .from("agencies")
        .select(`id, name, agency_carriers ( carriers ( name ) )`)
        .order("name"),
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
    ]);
    carriers = (c.data ?? []) as Carrier[];
    agencies = (a.data ?? []) as unknown as Agency[];
    stores = (s.data ?? []) as unknown as StoreRow[];
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
          MASTER DATA
        </p>
        <h1 className="text-xl font-semibold tracking-tight">マスタ</h1>
        <p className="text-sm text-muted-foreground">
          キャリア・代理店の階層を管理します。
        </p>
      </div>

      <Tabs defaultValue="carriers">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 rounded-xl border bg-card/70 p-1">
          <TabsTrigger value="carriers">イベント会社</TabsTrigger>
          <TabsTrigger value="agencies">代理店</TabsTrigger>
          <TabsTrigger value="stores">店舗</TabsTrigger>
        </TabsList>
        <TabsContent value="carriers" className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">イベント会社（キャリア）</CardTitle>
              <CardDescription>
                キャリアを自由に追加できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={createCarrier} className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-2 max-w-lg">
                  <Label htmlFor="carrier_name">キャリア名</Label>
                  <Input id="carrier_name" name="name" required placeholder="例: MVNO A社" />
                </div>
                <Button
                  type="submit"
                  disabled={!isSupabaseConfigured()}
                  className="h-10 rounded-lg border border-primary/40 px-4 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-md hover:text-white"
                >
                  登録
                </Button>
                {sp.created === "carrier" ? (
                  <p className="text-sm text-green-600 dark:text-green-400">登録しました。</p>
                ) : null}
                {sp.error && sp.error_target === "carrier" ? (
                  <p className="text-sm text-destructive">{decodeURIComponent(sp.error)}</p>
                ) : null}
              </form>
              {!isSupabaseConfigured() && (
                <p className="text-sm text-muted-foreground">
                  Supabase 接続後に表示されます。
                </p>
              )}
              <div className="rounded-xl border">
                {carriers.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">キャリアはまだありません。</p>
                ) : (
                  carriers.map((c, i) => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm ${
                        i !== carriers.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.code}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="agencies" className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">代理店を追加</CardTitle>
              <CardDescription>取扱キャリアを複数選択して登録</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAgency} className="space-y-4 rounded-xl border bg-muted/20 p-4 max-w-xl">
                <div className="space-y-2">
                  <Label>取扱キャリア（複数選択）</Label>
                  <div className="space-y-2 rounded-lg border border-input bg-background p-3">
                    {carriers.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                        <input type="checkbox" name="carrier_ids" value={c.id} className="h-4 w-4 rounded border-input" />
                        <span>{c.name}</span>
                      </label>
                    ))}
                    {carriers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">キャリアがありません。先に追加してください。</p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agency_name">代理店名</Label>
                  <Input id="agency_name" name="name" required />
                </div>
                <Button
                  type="submit"
                  disabled={!isSupabaseConfigured()}
                  className="h-10 rounded-lg border border-primary/40 px-4 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-md hover:text-white"
                >
                  登録
                </Button>
                {sp.created === "agency" ? (
                  <p className="text-sm text-green-600 dark:text-green-400">登録しました。</p>
                ) : null}
                {sp.error && sp.error_target === "agency" ? (
                  <p className="text-sm text-destructive">{decodeURIComponent(sp.error)}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              登録済み代理店
            </h2>
            {agencies.length === 0 && isSupabaseConfigured() && (
              <p className="text-sm text-muted-foreground">まだありません。</p>
            )}
            <div className="grid gap-2">
              {agencies.map((a) => (
                <div key={a.id} className="rounded-xl border bg-card px-3 py-3 text-sm shadow-xs">
                  <p className="font-medium">{a.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(
                      a.agency_carriers
                        ?.map((r) => r.carriers?.name)
                        .filter(Boolean) as string[]
                    ).join(" / ") || "キャリア未設定"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stores" className="mt-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">店舗を追加</CardTitle>
              <CardDescription>
                案件で使用するイベント場所をマスタ登録します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sp.store_created === "1" ? (
                <p className="text-sm text-green-600 dark:text-green-400">店舗を登録しました。</p>
              ) : null}
              {sp.store_updated === "1" ? (
                <p className="text-sm text-green-600 dark:text-green-400">店舗を更新しました。</p>
              ) : null}
              {sp.store_deleted === "1" ? (
                <p className="text-sm text-green-600 dark:text-green-400">店舗を削除しました。</p>
              ) : null}
              {sp.store_error ? (
                <p className="text-sm text-destructive">{decodeURIComponent(sp.store_error)}</p>
              ) : null}
              {!isSupabaseConfigured() ? (
                <p className="text-sm text-muted-foreground">
                  Supabase 接続後に表示されます。
                </p>
              ) : (
                <StoresPageClient
                  stores={stores}
                  agencies={agencies.map((a) => ({
                    id: a.id,
                    name: a.name,
                    carrierName:
                      (a.agency_carriers?.[0]?.carriers?.name as string | undefined) ?? null,
                  }))}
                  canMutate={isSupabaseConfigured()}
                  returnTo="masters"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
