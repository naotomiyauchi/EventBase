import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { StoresPageClient } from "@/components/stores-page-client";

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }>;
}) {
  const sp = await searchParams;

  type Row = {
    id: string;
    agency_id: string;
    name: string;
    address: string | null;
    access_notes: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    entry_rules: string | null;
    agencies: { name: string; carriers: { name: string } | null } | null;
  };
  let rows: Row[] = [];
  let agencies: { id: string; name: string; carriers: { name: string } | null }[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [storeRes, agRes] = await Promise.all([
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
        .select(`id, name, carriers ( name )`)
        .order("name"),
    ]);
    rows = (storeRes.data ?? []) as unknown as Row[];
    agencies = (agRes.data ?? []) as unknown as typeof agencies;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">現場マスタ</h1>
        <p className="text-sm text-muted-foreground">
          店舗の住所・入館ルール・担当連絡先を蓄積します。
        </p>
      </div>

      {sp.created && (
        <p className="text-sm text-green-600 dark:text-green-400">
          現場を登録しました。
        </p>
      )}
      {sp.updated && (
        <p className="text-sm text-green-600 dark:text-green-400">
          現場を更新しました。
        </p>
      )}
      {sp.deleted && (
        <p className="text-sm text-green-600 dark:text-green-400">
          現場を削除しました。
        </p>
      )}
      {sp.error && (
        <p className="text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {!isSupabaseConfigured() ? (
        <p className="text-sm text-muted-foreground">
          Supabase 接続後に表示されます。
        </p>
      ) : (
        <StoresPageClient
          stores={rows}
          agencies={agencies.map((a) => ({
            id: a.id,
            name: a.name,
            carrierName: a.carriers?.name ?? null,
          }))}
          canMutate={isSupabaseConfigured()}
        />
      )}
    </div>
  );
}
