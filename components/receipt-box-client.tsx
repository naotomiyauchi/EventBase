"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

type Props = {
  tenantSlug: string;
  projects: Option[];
  agencies: Option[];
};

const CATEGORY_OPTIONS = [
  { value: "transport", label: "交通費" },
  { value: "parking", label: "駐車場代" },
  { value: "supplies", label: "備品" },
  { value: "meal", label: "飲食" },
  { value: "lodging", label: "宿泊" },
  { value: "other", label: "その他" },
];

const PAYMENT_OPTIONS = [
  { value: "cash", label: "現金" },
  { value: "bank", label: "銀行振込" },
  { value: "card", label: "カード" },
  { value: "other", label: "その他" },
];

export function ReceiptBoxClient({ tenantSlug, projects, agencies }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("receipt_file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("領収書画像を選択してください。");
      return;
    }

    setLoading(true);
    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const path = `${tenantSlug}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabase.storage
      .from("receipt-files")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setLoading(false);
      setMessage(uploadErr.message);
      return;
    }

    const amount = Number(String(fd.get("amount") ?? "0"));
    const taxAmount = Number(String(fd.get("tax_amount") ?? "0"));
    const payload = {
      expense_date: String(fd.get("expense_date") ?? ""),
      vendor: String(fd.get("vendor") ?? "").trim() || null,
      category: String(fd.get("category") ?? "other"),
      payment_method: String(fd.get("payment_method") ?? "cash"),
      amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
      tax_amount: Number.isFinite(taxAmount) ? Math.max(0, taxAmount) : 0,
      memo: String(fd.get("memo") ?? "").trim() || null,
      project_id: String(fd.get("project_id") ?? "").trim() || null,
      agency_id: String(fd.get("agency_id") ?? "").trim() || null,
      file_path: path,
    };

    const { error: insertErr } = await supabase.from("finance_receipts").insert(payload);
    setLoading(false);
    if (insertErr) {
      setMessage(insertErr.message);
      return;
    }

    form.reset();
    setMessage("領収書を登録しました。出納帳へ自動反映されます。");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expense_date">利用日</Label>
          <Input id="expense_date" name="expense_date" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">金額</Label>
          <Input id="amount" name="amount" type="number" min={0} step="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax_amount">消費税額（任意）</Label>
          <Input id="tax_amount" name="tax_amount" type="number" min={0} step="1" defaultValue="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">支払先（任意）</Label>
          <Input id="vendor" name="vendor" placeholder="例: 〇〇交通" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">カテゴリ</Label>
          <select
            id="category"
            name="category"
            defaultValue="other"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_method">支払方法</Label>
          <select
            id="payment_method"
            name="payment_method"
            defaultValue="cash"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project_id">案件（任意）</Label>
          <select
            id="project_id"
            name="project_id"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">未選択</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agency_id">代理店（任意）</Label>
          <select
            id="agency_id"
            name="agency_id"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">未選択</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="receipt_file">領収書画像</Label>
        <Input id="receipt_file" name="receipt_file" type="file" accept="image/*,.pdf" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="memo">メモ（任意）</Label>
        <Textarea id="memo" name="memo" placeholder="用途や補足など" />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "アップロード中…" : "領収書を登録"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
