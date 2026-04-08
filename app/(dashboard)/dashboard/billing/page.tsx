import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import {
  addCustomBillingLineAction,
  approveEstimateAction,
  generateBillingDraftAction,
  sendBillingEmailAction,
  updateBillingStatusAction,
} from "@/app/actions/billing";

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  issued: "発行済み",
  sent: "送信済み",
  overdue: "未入金（期限超過）",
  paid: "入金済み",
  cancelled: "取消",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    draft_created?: string;
    status_updated?: string;
    line_added?: string;
    mail_sent?: string;
    estimate_approved?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [{ data: projects }, { data: agencies }, { data: docs }, { data: lines }, { data: logs }] = await Promise.all([
    supabase.from("projects").select("id, title").order("updated_at", { ascending: false }).limit(200),
    supabase.from("agencies").select("id, name").order("name"),
    supabase
      .from("billing_documents")
      .select(
        `
        id, kind, status, doc_no, issue_date, due_date, subtotal, tax_amount, total_amount,
        recipient_email, bcc_email, approved_at,
        agencies ( name ),
        projects ( title )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("billing_document_lines")
      .select("id, document_id, sort_order, description, quantity, unit_price, amount")
      .order("sort_order", { ascending: true }),
    supabase
      .from("billing_send_logs")
      .select("id, document_id, to_email, bcc_email, sent_at, status")
      .order("sent_at", { ascending: false }),
  ]);

  const nowYm = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">請求・見積</h1>
        <p className="text-sm text-muted-foreground">
          シフト実績（退勤済み）と経費実績から、請求/見積のドラフトを自動生成します。
        </p>
      </div>

      {sp.draft_created && (
        <p className="text-sm text-green-600 dark:text-green-400">ドラフトを作成しました。</p>
      )}
      {sp.status_updated && (
        <p className="text-sm text-green-600 dark:text-green-400">ステータスを更新しました。</p>
      )}
      {sp.line_added && (
        <p className="text-sm text-green-600 dark:text-green-400">明細を追加しました。</p>
      )}
      {sp.mail_sent && (
        <p className="text-sm text-green-600 dark:text-green-400">メールを送信しました。</p>
      )}
      {sp.estimate_approved && (
        <p className="text-sm text-green-600 dark:text-green-400">見積承認を受領し、案件を受注化しました。</p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">案件単位でドラフト作成</CardTitle>
            <CardDescription>対象案件の退勤済み実績を集計します。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={generateBillingDraftAction} className="space-y-3">
              <input type="hidden" name="mode" value="project" />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">書類種別</p>
                <select
                  name="kind"
                  defaultValue="invoice"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="invoice">請求書</option>
                  <option value="estimate">見積書</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">案件</p>
                <select
                  name="project_id"
                  required
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="" disabled>選択してください</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="tax_rate" type="number" step="0.01" min="0" defaultValue="10" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                <input name="due_date" type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>
              <Button type="submit">ドラフト作成</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">代理店 × 月でドラフト作成</CardTitle>
            <CardDescription>今月分などを一括集計します。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={generateBillingDraftAction} className="space-y-3">
              <input type="hidden" name="mode" value="agency_month" />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">書類種別</p>
                <select
                  name="kind"
                  defaultValue="invoice"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="invoice">請求書</option>
                  <option value="estimate">見積書</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">代理店</p>
                <select
                  name="agency_id"
                  required
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="" disabled>選択してください</option>
                  {(agencies ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="target_month" type="month" defaultValue={nowYm} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                <input name="tax_rate" type="number" step="0.01" min="0" defaultValue="10" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
              </div>
              <Button type="submit">ドラフト作成</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">書類一覧</CardTitle>
          <CardDescription>発行/未入金/入金済みの管理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(docs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ書類はありません。</p>
          ) : (
            (docs ?? []).map((d) => {
              const docLines = (lines ?? []).filter((l) => l.document_id === d.id);
              const docLogs = (logs ?? []).filter((l) => l.document_id === d.id).slice(0, 5);
              const isOverdue =
                !!d.due_date &&
                (d.status === "issued" || d.status === "sent") &&
                new Date(d.due_date).getTime() <
                  new Date(
                    new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Tokyo",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date())
                  ).getTime();
              return (
                <div key={d.id} className="space-y-3 rounded border px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {d.doc_no} / {d.kind === "invoice" ? "請求書" : "見積書"}
                        {isOverdue && (
                          <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                            期限超過
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(d.agencies as { name?: string }[] | null)?.[0]?.name ?? "代理店未設定"}
                        {" / "}
                        {(d.projects as { title?: string }[] | null)?.[0]?.title ?? "案件横断"}
                        {" / 合計 "}
                        {Math.round(Number(d.total_amount ?? 0)).toLocaleString("ja-JP")} 円
                      </p>
                    </div>
                    <form action={updateBillingStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <select
                        name="status"
                        defaultValue={isOverdue ? "overdue" : d.status}
                        className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">更新</Button>
                    </form>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/billing/${d.id}/export?format=pdf`}
                      className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs hover:bg-muted"
                    >
                      PDF
                    </a>
                    <a
                      href={`/api/billing/${d.id}/export?format=xlsx`}
                      className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs hover:bg-muted"
                    >
                      スプレッドシート出力
                    </a>
                    {d.kind === "estimate" && !d.approved_at && (
                      <form action={approveEstimateAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          見積承認→受注化
                        </Button>
                      </form>
                    )}
                  </div>

                  <div className="space-y-2 rounded-md border p-2">
                    <p className="text-xs font-medium">明細</p>
                    {docLines.length === 0 ? (
                      <p className="text-xs text-muted-foreground">明細はありません。</p>
                    ) : (
                      docLines.map((l) => (
                        <p key={l.id} className="text-xs">
                          {l.description} / {l.quantity} × {Number(l.unit_price).toLocaleString("ja-JP")} ={" "}
                          {Number(l.amount).toLocaleString("ja-JP")} 円
                        </p>
                      ))
                    )}
                    <form action={addCustomBillingLineAction} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                      <input type="hidden" name="document_id" value={d.id} />
                      <input name="description" placeholder="自由項目（設営費・機材・宿泊・インセン等）" className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs" />
                      <input name="quantity" type="number" step="0.01" min="0" defaultValue="1" className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs" />
                      <input name="unit_price" type="number" step="0.01" min="0" defaultValue="0" className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs" />
                      <Button type="submit" size="sm">追加</Button>
                    </form>
                  </div>

                  <div className="space-y-2 rounded-md border p-2">
                    <p className="text-xs font-medium">送信</p>
                    <form action={sendBillingEmailAction} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
                      <input type="hidden" name="id" value={d.id} />
                      <input
                        name="to_email"
                        type="email"
                        required
                        defaultValue={d.recipient_email ?? ""}
                        placeholder="送信先メール"
                        className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      />
                      <input
                        name="bcc_email"
                        type="email"
                        defaultValue={d.bcc_email ?? ""}
                        placeholder="BCC（任意）"
                        className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      />
                      <Button type="submit" size="sm">メール送信</Button>
                    </form>
                    {docLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">送信履歴なし</p>
                    ) : (
                      docLogs.map((lg) => (
                        <p key={lg.id} className="text-xs text-muted-foreground">
                          {lg.sent_at} / To: {lg.to_email}
                          {lg.bcc_email ? ` / Bcc: ${lg.bcc_email}` : ""}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

