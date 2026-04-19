import { Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  publishDraftShiftsAction,
  sendLineShiftBroadcastAction,
  syncShiftsToGoogleCalendarAction,
} from "@/app/actions/shifts";

function jstDayOffset(base: string, add: number): string {
  const d = new Date(`${base}T00:00:00+09:00`);
  d.setDate(d.getDate() + add);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function ShiftManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    project_id?: string;
    start?: string;
    end?: string;
    days?: string;
    created?: string;
    published?: string;
    line_sent?: string;
    synced?: string;
    gcal_created?: string;
    gcal_updated?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.start ?? "") ? String(sp.start) : today;
  const requestedEnd = /^\d{4}-\d{2}-\d{2}$/.test(sp.end ?? "") ? String(sp.end) : null;
  const days = Math.min(14, Math.max(3, Number(sp.days ?? "7") || 7));
  const endDate = requestedEnd ?? jstDayOffset(startDate, days - 1);

  return (
    <div className="space-y-5">
      {sp.created && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          案件にシフトを追加しました。
        </p>
      )}
      {sp.published && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          対象期間のシフトを公開しました。
        </p>
      )}
      {sp.line_sent && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          LINE通知を送信しました（{sp.line_sent}件）。
        </p>
      )}
      {sp.synced && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          Googleカレンダー同期完了（新規: {sp.gcal_created ?? "0"}件 / 更新: {sp.gcal_updated ?? "0"}件）
        </p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card className="border-border/80 shadow-xs">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-base">公開・連携</CardTitle>
          <CardDescription>指定期間の全シフトを対象に、公開・LINE通知・Google同期を実行できます。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 lg:grid-cols-3">
          <form action={publishDraftShiftsAction} className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium">公開</p>
            <div className="space-y-2">
              <Input name="start_date" type="date" defaultValue={startDate} required />
              <Input name="end_date" type="date" defaultValue={endDate} required />
              <Button type="submit" variant="secondary" className="w-full">
                下書きを公開
              </Button>
            </div>
          </form>

          <form action={sendLineShiftBroadcastAction} className="rounded-xl border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Send className="size-4" />
              LINE通知
            </p>
            <div className="space-y-2">
              <Input name="start_date" type="date" defaultValue={startDate} required />
              <Input name="end_date" type="date" defaultValue={endDate} required />
              <Button type="submit" className="w-full">
                LINEへ送信
              </Button>
            </div>
          </form>

          <form action={syncShiftsToGoogleCalendarAction} className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium">Googleカレンダー同期</p>
            <div className="space-y-2">
              <Input name="start_date" type="date" defaultValue={startDate} required />
              <Input name="end_date" type="date" defaultValue={endDate} required />
              <Button type="submit" variant="outline" className="w-full">
                同期する
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
