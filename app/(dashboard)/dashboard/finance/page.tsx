import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { ReceiptBoxClient } from "@/components/receipt-box-client";

function yen(v: number | null | undefined) {
  return `${Math.round(Number(v ?? 0)).toLocaleString("ja-JP")}円`;
}

export default async function FinancePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [
    { data: tenant },
    { data: projects },
    { data: agencies },
    { data: receipts },
    { data: cashbook },
  ] = await Promise.all([
    supabase.from("tenants").select("slug").eq("id", profile.tenant_id).maybeSingle(),
    supabase.from("projects").select("id, title").order("updated_at", { ascending: false }).limit(200),
    supabase.from("agencies").select("id, name").order("name"),
    supabase
      .from("finance_receipts")
      .select(
        `
        id, expense_date, vendor, category, payment_method, amount, tax_amount, memo, file_path,
        projects ( title ),
        agencies ( name )
      `
      )
      .order("expense_date", { ascending: false })
      .limit(200),
    supabase
      .from("finance_cashbook_entries")
      .select("id, entry_date, entry_type, account, category, description, amount")
      .order("entry_date", { ascending: false })
      .limit(200),
  ]);

  const rows = (receipts ?? []) as {
    id: string;
    expense_date: string;
    vendor: string | null;
    category: string;
    payment_method: string;
    amount: number;
    tax_amount: number;
    memo: string | null;
    file_path: string;
    projects: { title?: string }[] | null;
    agencies: { name?: string }[] | null;
  }[];

  const pathList = rows.map((r) => r.file_path);
  const signedMap = new Map<string, string>();
  if (pathList.length > 0) {
    const { data: signed } = await supabase.storage.from("receipt-files").createSignedUrls(pathList, 60 * 60);
    for (let i = 0; i < pathList.length; i += 1) {
      const url = signed?.[i]?.signedUrl;
      if (url) signedMap.set(pathList[i], url);
    }
  }

  const thisMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const monthRows = rows.filter((r) => r.expense_date.startsWith(thisMonth));
  const monthTotal = monthRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const monthTax = monthRows.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  const cashRows = monthRows.filter((r) => r.payment_method === "cash");
  const cashTotal = cashRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const categoryTotals = monthRows.reduce<Record<string, number>>((acc, r) => {
    const k = r.category || "other";
    acc[k] = (acc[k] ?? 0) + Number(r.amount ?? 0);
    return acc;
  }, {});

  const cashbookRows = (cashbook ?? []) as {
    id: string;
    entry_date: string;
    entry_type: "income" | "expense" | "adjustment";
    account: string;
    category: string | null;
    description: string | null;
    amount: number;
  }[];

  const running = [...cashbookRows]
    .reverse()
    .reduce<{ id: string; balance: number }[]>((acc, r) => {
      const prev = acc.length === 0 ? 0 : acc[acc.length - 1].balance;
      const next = prev + (r.entry_type === "income" ? Number(r.amount) : -Number(r.amount));
      acc.push({ id: r.id, balance: next });
      return acc;
    }, []);
  const balanceMap = new Map(running.map((r) => [r.id, r.balance]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">領収書ボックス・出納</h1>
        <p className="text-sm text-muted-foreground">
          領収書をアップロードすると経費データと出納帳へ自動連携され、会計入力の手間を減らします。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当月経費合計</CardDescription>
            <CardTitle className="text-xl">{yen(monthTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当月消費税</CardDescription>
            <CardTitle className="text-xl">{yen(monthTax)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当月現金支出</CardDescription>
            <CardTitle className="text-xl">{yen(cashTotal)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">領収書を登録</CardTitle>
          <CardDescription>画像/PDFをアップロードして、経費と出納へ即時反映</CardDescription>
        </CardHeader>
        <CardContent>
          <ReceiptBoxClient
            tenantSlug={tenant?.slug ?? "default"}
            projects={(projects ?? []).map((p) => ({ id: p.id, name: p.title }))}
            agencies={(agencies ?? []).map((a) => ({ id: a.id, name: a.name }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">当月カテゴリ別経費</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(categoryTotals).length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません。</p>
            ) : (
              Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <span>{k}</span>
                    <span className="font-medium">{yen(v)}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">現金出納帳</CardTitle>
            <CardDescription>領収書登録で自動記帳（収入/調整は今後追加）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cashbookRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません。</p>
            ) : (
              cashbookRows.map((r) => (
                <div key={r.id} className="space-y-1 rounded border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{r.entry_date}</span>
                    <span className={r.entry_type === "income" ? "text-emerald-600" : "text-rose-600"}>
                      {r.entry_type === "income" ? "+" : "-"}
                      {yen(r.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.account} / {r.category ?? "other"} / {r.description ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    累計残高: {yen(balanceMap.get(r.id) ?? 0)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">領収書一覧</CardTitle>
          <CardDescription>会計入力前の確認用（税額・案件・代理店で検索しやすい構成）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ領収書がありません。</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="space-y-1 rounded border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {r.expense_date} / {r.vendor || "支払先未入力"} / {yen(r.amount)}
                  </p>
                  {signedMap.get(r.file_path) ? (
                    <a
                      href={signedMap.get(r.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      領収書を開く
                    </a>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.category} / {r.payment_method} / 税額 {yen(r.tax_amount)} / 案件:{" "}
                  {r.projects?.[0]?.title ?? "未紐付け"} / 代理店: {r.agencies?.[0]?.name ?? "未紐付け"}
                </p>
                {r.memo ? <p className="text-xs text-muted-foreground">{r.memo}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
