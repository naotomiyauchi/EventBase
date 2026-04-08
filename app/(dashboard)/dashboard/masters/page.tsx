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
import { createAgency } from "@/app/actions/agencies";

export default async function MastersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const sp = await searchParams;

  type Carrier = { id: string; code: string; name: string };
  type Agency = {
    id: string;
    name: string;
    carriers: { name: string } | null;
  };
  let carriers: Carrier[] = [];
  let agencies: Agency[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [c, a] = await Promise.all([
      supabase.from("carriers").select("id, code, name").order("sort_order"),
      supabase
        .from("agencies")
        .select(`id, name, carriers ( name )`)
        .order("name"),
    ]);
    carriers = (c.data ?? []) as Carrier[];
    agencies = (a.data ?? []) as unknown as Agency[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">マスタ</h1>
        <p className="text-sm text-muted-foreground">
          キャリア・代理店の階層を管理します。
        </p>
      </div>

      {sp.created && (
        <p className="text-sm text-green-600 dark:text-green-400">
          代理店を登録しました。
        </p>
      )}
      {sp.error && (
        <p className="text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Tabs defaultValue="carriers">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="carriers">キャリア</TabsTrigger>
          <TabsTrigger value="agencies">代理店</TabsTrigger>
        </TabsList>
        <TabsContent value="carriers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">キャリア</CardTitle>
              <CardDescription>
                初期データ（DoCoMo / au / SoftBank / 楽天）。運用で増やす場合は DB から追加してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isSupabaseConfigured() && (
                <p className="text-sm text-muted-foreground">
                  Supabase 接続後に表示されます。
                </p>
              )}
              {carriers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.code}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="agencies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">代理店を追加</CardTitle>
              <CardDescription>キャリアに紐付けて登録</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAgency} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="carrier_id">キャリア</Label>
                  <select
                    id="carrier_id"
                    name="carrier_id"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      選択
                    </option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agency_name">代理店名</Label>
                  <Input id="agency_name" name="name" required />
                </div>
                <Button type="submit" disabled={!isSupabaseConfigured()}>
                  登録
                </Button>
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
                <div
                  key={a.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{a.name}</span>
                  {a.carriers?.name && (
                    <span className="ml-2 text-muted-foreground">
                      ({a.carriers.name})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
