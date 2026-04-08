"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export type WorkHistoryRowState = {
  year: string;
  month: string;
  period_label: string;
  job_content: string;
};

type Props = {
  initialRows: WorkHistoryRowState[];
};

export function StaffWorkHistoryEditor({ initialRows }: Props) {
  const [rows, setRows] = useState<WorkHistoryRowState[]>(() =>
    initialRows.length > 0
      ? initialRows
      : [{ year: "", month: "", period_label: "", job_content: "" }]
  );

  function addRow() {
    setRows([
      ...rows,
      { year: "", month: "", period_label: "", job_content: "" },
    ]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      setRows([{ year: "", month: "", period_label: "", job_content: "" }]);
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  }

  function patch(index: number, key: keyof WorkHistoryRowState, value: string) {
    setRows(
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    );
  }

  const payload = rows.map((r) => ({
    year: r.year.trim() ? parseInt(r.year, 10) : null,
    month: r.month.trim() ? parseInt(r.month, 10) : null,
    period_label: r.period_label.trim() || null,
    job_content: r.job_content.trim() || null,
  }));

  return (
    <div className="space-y-4">
      <input type="hidden" name="work_history_json" value={JSON.stringify(payload)} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium leading-none">職務経歴</p>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          行を追加
        </Button>
      </div>
      <div className="space-y-6">
        {rows.map((row, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                経歴 {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 shrink-0 text-muted-foreground"
                onClick={() => removeRow(index)}
                aria-label="この行を削除"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>年（西暦）</Label>
                <Input
                  inputMode="numeric"
                  placeholder="例: 2023"
                  value={row.year}
                  onChange={(e) => patch(index, "year", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>月</Label>
                <Input
                  inputMode="numeric"
                  placeholder="1–12"
                  value={row.month}
                  onChange={(e) => patch(index, "month", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>勤務期間</Label>
              <Input
                placeholder="例: 3ヶ月 / 2023年4月〜6月"
                value={row.period_label}
                onChange={(e) => patch(index, "period_label", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>職務内容</Label>
              <Textarea
                placeholder="キャッチ、クローズ、受付など"
                rows={3}
                value={row.job_content}
                onChange={(e) => patch(index, "job_content", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
