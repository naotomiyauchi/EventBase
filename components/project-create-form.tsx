"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createProject } from "@/app/actions/projects";
import {
  createAgencyInline,
  createCarrierInline,
  createStoreInline,
} from "@/app/actions/masters-inline";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER } from "@/lib/project-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectStatus } from "@/lib/types/database";

type CarrierOption = { id: string; name: string };
type AgencyOption = { id: string; name: string; carrierIds: string[] };
type StoreOption = { id: string; name: string; agency_id: string };

type Props = {
  stores: StoreOption[];
  carriers: CarrierOption[];
  agencies: AgencyOption[];
  isSupabaseReady: boolean;
};

export function ProjectCreateForm({ stores, carriers, agencies, isSupabaseReady }: Props) {
  const [localCarriers, setLocalCarriers] = useState(carriers);
  const [localAgencies, setLocalAgencies] = useState(agencies);
  const [localStores, setLocalStores] = useState(stores);

  const [carrierId, setCarrierId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [inlineSuccess, setInlineSuccess] = useState("");

  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
  const [agencyDialogOpen, setAgencyDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);

  const [carrierName, setCarrierName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyCarrierIds, setAgencyCarrierIds] = useState<string[]>([]);
  const [storeAgencyId, setStoreAgencyId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeAccessNotes, setStoreAccessNotes] = useState("");
  const [storeContactName, setStoreContactName] = useState("");
  const [storeContactPhone, setStoreContactPhone] = useState("");
  const [storeEntryRules, setStoreEntryRules] = useState("");

  const [isPending, startTransition] = useTransition();

  const carrierNameById = useMemo(
    () => Object.fromEntries(localCarriers.map((c) => [c.id, c.name])),
    [localCarriers]
  );
  const agencyNameById = useMemo(
    () => Object.fromEntries(localAgencies.map((a) => [a.id, a.name])),
    [localAgencies]
  );

  const agenciesUnderCarrier = useMemo(() => {
    if (!carrierId) return [];
    return localAgencies.filter((a) => a.carrierIds.includes(carrierId));
  }, [localAgencies, carrierId]);

  const storesUnderAgency = useMemo(() => {
    if (!agencyId) return [];
    return localStores.filter((s) => s.agency_id === agencyId);
  }, [localStores, agencyId]);

  const relatedEntitiesValue = useMemo(() => {
    const labels = [
      carrierId ? carrierNameById[carrierId] : "",
      agencyId ? agencyNameById[agencyId] : "",
      storeId ? localStores.find((s) => s.id === storeId)?.name : "",
    ].filter(Boolean);
    return labels.join(" / ") || null;
  }, [carrierId, agencyId, storeId, carrierNameById, agencyNameById, localStores]);

  const supervisorOptions = useMemo(
    () => [
      ...localCarriers.map((c) => ({
        key: `carrier:${c.id}`,
        value: `キャリア: ${c.name}`,
      })),
      ...localAgencies.map((a) => ({
        key: `agency:${a.id}`,
        value: `代理店: ${a.name}`,
      })),
      ...localStores.map((s) => ({
        key: `store:${s.id}`,
        value: `店舗: ${s.name}`,
      })),
    ],
    [localCarriers, localAgencies, localStores]
  );

  const handleCreateCarrier = () => {
    setInlineError("");
    setInlineSuccess("");
    startTransition(async () => {
      const result = await createCarrierInline({ name: carrierName });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      setLocalCarriers((prev) => [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCarrierId(result.data.id);
      setCarrierName("");
      setCarrierDialogOpen(false);
      setInlineSuccess("イベント会社を追加しました。");
    });
  };

  const handleCreateAgency = () => {
    setInlineError("");
    setInlineSuccess("");
    startTransition(async () => {
      const result = await createAgencyInline({
        name: agencyName,
        carrier_ids: agencyCarrierIds,
      });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      setLocalAgencies((prev) =>
        [...prev, { id: result.data.id, name: result.data.name, carrierIds: result.data.carrier_ids }].sort(
          (a, b) => a.name.localeCompare(b.name)
        )
      );
      if (!carrierId && result.data.carrier_ids[0]) {
        setCarrierId(result.data.carrier_ids[0]);
      }
      setAgencyId(result.data.id);
      setAgencyName("");
      setAgencyCarrierIds([]);
      setAgencyDialogOpen(false);
      setInlineSuccess("代理店を追加しました。");
    });
  };

  const handleCreateStore = () => {
    setInlineError("");
    setInlineSuccess("");
    startTransition(async () => {
      const result = await createStoreInline({
        agency_id: storeAgencyId,
        name: storeName,
        address: storeAddress,
        access_notes: storeAccessNotes,
        contact_name: storeContactName,
        contact_phone: storeContactPhone,
        entry_rules: storeEntryRules,
      });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      setLocalStores((prev) =>
        [...prev, { id: result.data.id, name: result.data.name, agency_id: result.data.agency_id }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setAgencyId(result.data.agency_id);
      setStoreId(result.data.id);
      setStoreDialogOpen(false);
      setStoreName("");
      setStoreAddress("");
      setStoreAccessNotes("");
      setStoreContactName("");
      setStoreContactPhone("");
      setStoreEntryRules("");
      setInlineSuccess("店舗を追加しました。");
    });
  };

  return (
    <form action={createProject} className="space-y-5">
      {inlineSuccess ? (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          {inlineSuccess}
        </p>
      ) : null}
      {inlineError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          追加に失敗しました: {inlineError}
        </p>
      ) : null}

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">基本情報</p>
        <div className="space-y-2">
          <Label htmlFor="title">案件名</Label>
          <Input id="title" name="title" required placeholder="例: 〇〇店 春のキャンペーン" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overview">概要（説明）</Label>
          <Textarea id="overview" name="overview" rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">ステータス</Label>
          <select
            id="status"
            name="status"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue={"proposal" as ProjectStatus}
          >
            {PROJECT_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {PROJECT_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">案件に関わる会社（選択式）</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>元請け（キャリア）</Label>
            <select
              value={carrierId}
              onChange={(e) => {
                setCarrierId(e.target.value);
                setAgencyId("");
                setStoreId("");
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">選択してください</option>
              {localCarriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>代理店</Label>
            <select
              value={agencyId}
              onChange={(e) => {
                setAgencyId(e.target.value);
                setStoreId("");
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">選択してください</option>
              {agenciesUnderCarrier.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>店舗</Label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">選択してください</option>
              {storesUnderAgency.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <input type="hidden" name="related_entities" value={relatedEntitiesValue ?? ""} />
        <input type="hidden" name="store_id" value={storeId} />
        <p className="text-xs text-muted-foreground">
          選択結果: {relatedEntitiesValue ?? "未選択"}
        </p>
        {(localCarriers.length === 0 || localAgencies.length === 0 || localStores.length === 0) && (
          <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
            マスタ不足時は <Link href="/dashboard/masters" className="underline">マスタタブ</Link> へ移動、または
            この場で追加できます。
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setCarrierDialogOpen(true)}>
                イベント会社を追加
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAgencyDialogOpen(true)}>
                代理店を追加
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setStoreDialogOpen(true)}>
                店舗を追加
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">イベント情報</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event_period_start">期間（開始日）</Label>
            <Input id="event_period_start" name="event_period_start" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_period_end">期間（終了日）</Label>
            <Input id="event_period_end" name="event_period_end" type="date" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event_start_at">日時（開始）</Label>
            <Input id="event_start_at" name="event_start_at" type="datetime-local" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_end_at">日時（終了）</Label>
            <Input id="event_end_at" name="event_end_at" type="datetime-local" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_location">場所</Label>
          <Input id="event_location" name="event_location" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_location_map_url">GoogleマップURL</Label>
          <Input id="event_location_map_url" name="event_location_map_url" type="url" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event_contact_name">イベント場所の担当者</Label>
            <Input id="event_contact_name" name="event_contact_name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_contact_phone">電話番号</Label>
            <Input id="event_contact_phone" name="event_contact_phone" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_notes">イベント場所の注意事項</Label>
          <Textarea id="event_notes" name="event_notes" rows={3} />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">指揮系統・報酬</p>
        <div className="space-y-2">
          <Label>直属の上司に当たる会社（選択式）</Label>
          <select
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">選択してください</option>
            {supervisorOptions.map((opt) => (
              <option key={opt.key} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
          <input type="hidden" name="direct_supervisor_entity" value={supervisor} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing_target_entity">請求や見積もりを出す会社</Label>
          <Input id="billing_target_entity" name="billing_target_entity" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="compensation_type">案件の報酬形態</Label>
            <select
              id="compensation_type"
              name="compensation_type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              defaultValue=""
            >
              <option value="">未設定</option>
              <option value="daily">日当</option>
              <option value="commission">歩合</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brokerage_rate">中抜き率（%）</Label>
            <Input id="brokerage_rate" name="brokerage_rate" type="number" min={0} max={100} step="0.01" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brokerage_notes">報酬補足</Label>
          <Textarea id="brokerage_notes" name="brokerage_notes" rows={2} />
        </div>
      </div>

      <Button
        type="submit"
        disabled={!isSupabaseReady || isPending}
        className="h-10 rounded-lg border border-primary/40 px-4 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-md hover:text-white"
      >
        案件を登録
      </Button>

      <Dialog open={carrierDialogOpen} onOpenChange={setCarrierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>イベント会社（キャリア）を追加</DialogTitle>
            <DialogDescription>案件入力を保持したまま追加できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="inline_carrier_name">会社名</Label>
              <Input id="inline_carrier_name" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
            </div>
            <Button type="button" onClick={handleCreateCarrier} disabled={isPending}>
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={agencyDialogOpen} onOpenChange={setAgencyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>代理店を追加</DialogTitle>
            <DialogDescription>複数キャリアを選択できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="inline_agency_name">代理店名</Label>
              <Input id="inline_agency_name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              {localCarriers.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agencyCarrierIds.includes(c.id)}
                    onChange={(e) =>
                      setAgencyCarrierIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <Button type="button" onClick={handleCreateAgency} disabled={isPending}>
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>店舗を追加</DialogTitle>
            <DialogDescription>案件入力を中断せずに追加できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>代理店</Label>
              <select
                value={storeAgencyId}
                onChange={(e) => setStoreAgencyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">選択してください</option>
                {localAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>店舗名</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>住所</Label>
              <Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>アクセス</Label>
              <Textarea value={storeAccessNotes} onChange={(e) => setStoreAccessNotes(e.target.value)} rows={2} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>担当者</Label>
                <Input value={storeContactName} onChange={(e) => setStoreContactName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>電話</Label>
                <Input value={storeContactPhone} onChange={(e) => setStoreContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>入館・注意事項</Label>
              <Textarea value={storeEntryRules} onChange={(e) => setStoreEntryRules(e.target.value)} rows={2} />
            </div>
            <Button type="button" onClick={handleCreateStore} disabled={isPending}>
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
