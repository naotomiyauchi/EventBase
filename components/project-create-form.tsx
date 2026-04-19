"use client";

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
type StaffOption = { id: string; name: string };

type Props = {
  stores: StoreOption[];
  staffs: StaffOption[];
  carriers: CarrierOption[];
  agencies: AgencyOption[];
  isSupabaseReady: boolean;
};

export function ProjectCreateForm({ stores, staffs, carriers, agencies, isSupabaseReady }: Props) {
  const PROJECT_KIND_OPTIONS = ["スマホ（個人）", "スマホ（法人）", "ウォーターサーバー", "Anfraシステム"] as const;

  const [localCarriers, setLocalCarriers] = useState(carriers);
  const [localAgencies, setLocalAgencies] = useState(agencies);
  const [localStores, setLocalStores] = useState(stores);

  const [projectKind, setProjectKind] = useState("");
  const [personalStyle, setPersonalStyle] = useState("");
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
  const [eventLocation] = useState("");
  const [eventMapUrl, setEventMapUrl] = useState("");
  const [mapActionMessage, setMapActionMessage] = useState("");
  const [compensationPlan, setCompensationPlan] = useState("");
  const [anfraStaffIds, setAnfraStaffIds] = useState<string[]>([]);
  const [anfraProposalAmount, setAnfraProposalAmount] = useState("");
  const [anfraProposalBody, setAnfraProposalBody] = useState("");
  const [personalStaffIds, setPersonalStaffIds] = useState<string[]>([]);
  const [anfraCustomerName, setAnfraCustomerName] = useState("");

  const [isPending, startTransition] = useTransition();

  const mapSearchHref = useMemo(() => {
    const q = eventLocation.trim();
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
  }, [eventLocation]);

  const mapPreviewSrc = useMemo(() => {
    const mapUrl = eventMapUrl.trim();
    if (mapUrl.length > 0) {
      return `https://www.google.com/maps?q=${encodeURIComponent(mapUrl)}&output=embed`;
    }
    const q = eventLocation.trim();
    if (q.length > 0) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }
    return "";
  }, [eventMapUrl, eventLocation]);

  const canConfirmMap = mapPreviewSrc.length > 0;
  const confirmedMapUrl = useMemo(() => {
    const current = eventMapUrl.trim();
    if (current.length > 0) return current;
    return mapSearchHref;
  }, [eventMapUrl, mapSearchHref]);
  const derivedEventLocation = useMemo(() => {
    const raw = eventMapUrl.trim();
    if (!raw) return eventLocation.trim();
    try {
      const u = new URL(raw);
      const q =
        u.searchParams.get("query") ||
        u.searchParams.get("q") ||
        u.searchParams.get("destination") ||
        "";
      let candidate = q;
      if (!candidate) {
        const placeMatch = u.pathname.match(/\/place\/([^/]+)/);
        if (placeMatch?.[1]) {
          candidate = placeMatch[1].replace(/\+/g, " ");
        }
      }
      const normalized = decodeURIComponent(candidate).trim();
      return normalized || eventLocation.trim();
    } catch {
      return eventLocation.trim();
    }
  }, [eventMapUrl, eventLocation]);

  const applyMapUrl = (url: string) => {
    setEventMapUrl(url);
  };

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

  const selectedPersonalStaffNames = useMemo(
    () => staffs.filter((staff) => personalStaffIds.includes(staff.id)).map((staff) => staff.name),
    [staffs, personalStaffIds]
  );

  const selectedAnfraStaffNames = useMemo(
    () => staffs.filter((staff) => anfraStaffIds.includes(staff.id)).map((staff) => staff.name),
    [staffs, anfraStaffIds]
  );

  const toggleStaffSelection = (
    staffId: string,
    setSelectedIds: (updater: (prev: string[]) => string[]) => void
  ) => {
    setSelectedIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const supervisorOptions = useMemo(
    () => [
      ...(agencyId
        ? [
            {
              key: `agency:${agencyId}`,
              value: `代理店: ${agencyNameById[agencyId] ?? "未選択"}`,
            },
          ]
        : []),
      ...(storeId
        ? [
            {
              key: `store:${storeId}`,
              value: `イベント会社: ${
                localStores.find((s) => s.id === storeId)?.name ?? "未選択"
              }`,
            },
          ]
        : []),
    ],
    [agencyId, storeId, agencyNameById, localStores]
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
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">スマホ個人向け・ステップ入力</p>

        <div className="space-y-2">
          <Label htmlFor="project_kind" className="text-base font-semibold tracking-tight">
            ① 案件の種類
          </Label>
          <select
            id="project_kind"
            value={projectKind}
            onChange={(e) => {
              setProjectKind(e.target.value);
              setPersonalStyle("");
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">選択してください</option>
            {PROJECT_KIND_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {projectKind === "スマホ（個人）" && (
          <div className="space-y-2">
            <Label htmlFor="personal_style" className="text-base font-semibold tracking-tight">
              ② イベンター稼働かトップガン稼働か
            </Label>
            <select
              id="personal_style"
              value={personalStyle}
              onChange={(e) => setPersonalStyle(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">選択してください</option>
              <option value="イベンター">イベンター</option>
              <option value="トップガン">トップガン</option>
            </select>
          </div>
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <div className="space-y-2">
            <Label className="text-base font-semibold tracking-tight">
              ③ それは誰なのか
            </Label>
            <div className="grid gap-2 rounded-xl border bg-card/40 p-3 sm:grid-cols-2">
              {staffs.map((staff) => (
                <label
                  key={staff.id}
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={personalStaffIds.includes(staff.id)}
                    onChange={() => toggleStaffSelection(staff.id, setPersonalStaffIds)}
                  />
                  <span>{staff.name}</span>
                </label>
              ))}
            </div>
            {selectedPersonalStaffNames.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                選択中: {selectedPersonalStaffNames.join(" / ")}
              </p>
            ) : null}
          </div>
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>④ キャリアはどこなのか</Label>
                <select
                  value={carrierId}
                  onChange={(e) => {
                    setCarrierId(e.target.value);
                    setAgencyId("");
                    setStoreId("");
                    setSupervisor("");
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
                <Label>⑤ 代理店はどこなのか</Label>
                <select
                  value={agencyId}
                  onChange={(e) => {
                    setAgencyId(e.target.value);
                    setStoreId("");
                    setSupervisor("");
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
                <Label>⑥ イベント会社はどこなのか</Label>
                <select
                  value={storeId}
                  onChange={(e) => {
                    setStoreId(e.target.value);
                    setSupervisor("");
                  }}
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
            <p className="text-xs text-muted-foreground">選択結果: {relatedEntitiesValue ?? "未選択"}</p>
          </>
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <div className="space-y-2">
            <Label>
              ⑦ 指揮系統（いうことを聞くのは代理店かイベント会社か）
            </Label>
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
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <div className="space-y-2">
            <Label htmlFor="compensation_plan">⑧-1 案件自体の報酬形態</Label>
            <select
              id="compensation_plan"
              value={compensationPlan}
              onChange={(e) => setCompensationPlan(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">選択してください</option>
              <option value="フルコミ">フルコミ</option>
              <option value="日当">日当</option>
              <option value="フルコミ＋日当">フルコミ＋日当</option>
            </select>
          </div>
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <div className="space-y-2">
            <Label htmlFor="event_location_map_url">⑨-1 場所はどこなのか（Googleマップ）</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="event_location_map_url"
                name="event_location_map_url"
                type="text"
                inputMode="url"
                autoComplete="off"
                value={eventMapUrl}
                onChange={(e) => setEventMapUrl(e.target.value)}
                placeholder="Googleマップ共有URLを貼り付け"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!mapSearchHref}
                onClick={() => {
                  if (!mapSearchHref) return;
                  applyMapUrl(mapSearchHref);
                  window.open(mapSearchHref, "_blank", "noopener,noreferrer");
                  setMapActionMessage("Googleマップを開きました。場所を選んだらURLをコピーして「このマップで確定」を押してください。");
                }}
              >
                Googleマップで検索
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              場所を入力して検索し、開いたGoogleマップのURLをそのまま貼り付けできます。
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canConfirmMap}
                onClick={async () => {
                  setMapActionMessage("");
                  let clipboardUrl = "";
                  try {
                    clipboardUrl = (await navigator.clipboard.readText()).trim();
                  } catch {
                    // clipboard permission denied: fallback to current value
                  }
                  if (clipboardUrl && /^https?:\/\/(www\.)?google\.[^/]+\/maps/i.test(clipboardUrl)) {
                    applyMapUrl(clipboardUrl);
                    setMapActionMessage("クリップボードのGoogleマップURLで確定しました。");
                    return;
                  }
                  if (!confirmedMapUrl) return;
                  applyMapUrl(confirmedMapUrl);
                  setMapActionMessage("表示中のマップURLで確定しました。");
                }}
              >
                このマップで確定
              </Button>
            </div>
            {mapActionMessage ? (
              <p className="text-xs text-muted-foreground">{mapActionMessage}</p>
            ) : null}
            <input type="hidden" name="event_location" value={derivedEventLocation} />
            {mapPreviewSrc ? (
              <div className="overflow-hidden rounded-xl border">
                <iframe
                  title="map-preview"
                  src={mapPreviewSrc}
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
          </div>
        )}

        {projectKind === "スマホ（個人）" && personalStyle && (
          <div className="space-y-2">
            <Label htmlFor="status">⑩-1 案件のステータス</Label>
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
        )}

        {projectKind === "Anfraシステム" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="anfra_customer_name">① 顧客名</Label>
              <Input
                id="anfra_customer_name"
                value={anfraCustomerName}
                onChange={(e) => setAnfraCustomerName(e.target.value)}
                required
                placeholder="例: 株式会社〇〇"
              />
            </div>
            <div className="space-y-2">
              <Label>② 担当スタッフは誰なのか</Label>
              <div className="grid gap-2 rounded-xl border bg-card/40 p-3 sm:grid-cols-2">
                {staffs.map((staff) => (
                  <label
                    key={staff.id}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={anfraStaffIds.includes(staff.id)}
                      onChange={() => toggleStaffSelection(staff.id, setAnfraStaffIds)}
                    />
                    <span>{staff.name}</span>
                  </label>
                ))}
              </div>
              {selectedAnfraStaffNames.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  選択中: {selectedAnfraStaffNames.join(" / ")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">② ステータス</Label>
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
            <div className="space-y-2">
              <Label htmlFor="anfra_proposal_amount">③ 提案の金額</Label>
              <Input
                id="anfra_proposal_amount"
                type="number"
                min={0}
                step="1"
                value={anfraProposalAmount}
                onChange={(e) => setAnfraProposalAmount(e.target.value)}
                placeholder="例: 300000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anfra_proposal_body">④ 提案の内容（自由入力）</Label>
              <Textarea
                id="anfra_proposal_body"
                rows={4}
                value={anfraProposalBody}
                onChange={(e) => setAnfraProposalBody(e.target.value)}
                placeholder="提案内容を入力"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_location_map_url">⑤ 顧客企業の場所（Googleマップ）</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="event_location_map_url"
                  name="event_location_map_url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  value={eventMapUrl}
                  onChange={(e) => setEventMapUrl(e.target.value)}
                  placeholder="Googleマップ共有URLを貼り付け"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!mapSearchHref}
                  onClick={() => {
                    if (!mapSearchHref) return;
                    applyMapUrl(mapSearchHref);
                    window.open(mapSearchHref, "_blank", "noopener,noreferrer");
                    setMapActionMessage("Googleマップを開きました。場所を選んだらURLをコピーして「このマップで確定」を押してください。");
                  }}
                >
                  Googleマップで検索
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                顧客企業の場所をGoogleマップで確認して登録できます。
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canConfirmMap}
                  onClick={async () => {
                    setMapActionMessage("");
                    let clipboardUrl = "";
                    try {
                      clipboardUrl = (await navigator.clipboard.readText()).trim();
                    } catch {
                      // clipboard permission denied: fallback to current value
                    }
                    if (clipboardUrl && /^https?:\/\/(www\.)?google\.[^/]+\/maps/i.test(clipboardUrl)) {
                      applyMapUrl(clipboardUrl);
                      setMapActionMessage("クリップボードのGoogleマップURLで確定しました。");
                      return;
                    }
                    if (!confirmedMapUrl) return;
                    applyMapUrl(confirmedMapUrl);
                    setMapActionMessage("表示中のマップURLで確定しました。");
                  }}
                >
                  このマップで確定
                </Button>
              </div>
              {mapActionMessage ? (
                <p className="text-xs text-muted-foreground">{mapActionMessage}</p>
              ) : null}
              <input type="hidden" name="event_location" value={derivedEventLocation} />
              {mapPreviewSrc ? (
                <div className="overflow-hidden rounded-xl border">
                  <iframe
                    title="map-preview-anfra"
                    src={mapPreviewSrc}
                    className="h-64 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}
            </div>
          </>
        )}

        <input
          type="hidden"
          name="overview"
          value={[
            `案件種類: ${projectKind || "未選択"}`,
            projectKind === "スマホ（個人）" ? `稼働種別: ${personalStyle || "未選択"}` : null,
            projectKind === "Anfraシステム"
              ? `担当スタッフ: ${selectedAnfraStaffNames.join(" / ") || "未選択"}`
              : null,
            projectKind === "Anfraシステム" && anfraProposalBody
              ? `提案内容: ${anfraProposalBody}`
              : null,
          ]
            .filter(Boolean)
            .join(" / ")}
        />
        <input
          type="hidden"
          name="title"
          value={
            projectKind === "スマホ（個人）"
              ? selectedPersonalStaffNames.join(" / ")
              : projectKind === "Anfraシステム"
                ? anfraCustomerName
                : ""
          }
        />
        <input
          type="hidden"
          name="billing_target_entity"
          value={
            (projectKind === "Anfraシステム"
              ? `担当スタッフ: ${selectedAnfraStaffNames.join(" / ")}`
              : storeId
              ? `イベント会社: ${localStores.find((s) => s.id === storeId)?.name ?? ""}`
              : agencyId
                ? `代理店: ${agencyNameById[agencyId] ?? ""}`
                : "") || ""
          }
        />
        {(projectKind === "スマホ（個人）"
          ? personalStaffIds
          : projectKind === "Anfraシステム"
            ? anfraStaffIds
            : []
        ).map((staffId) => (
          <input key={staffId} type="hidden" name="assigned_staff_ids" value={staffId} />
        ))}
        <input
          type="hidden"
          name="compensation_type"
          value={
            projectKind === "Anfraシステム"
              ? "commission"
              : compensationPlan.includes("日当")
                ? "daily"
                : compensationPlan.includes("フルコミ")
                  ? "commission"
                  : ""
          }
        />
        <input
          type="hidden"
          name="brokerage_rate"
          value={projectKind === "Anfraシステム" ? anfraProposalAmount : ""}
        />
        <input
          type="hidden"
          name="brokerage_notes"
          value={projectKind === "Anfraシステム" ? "歩合のみ" : compensationPlan || ""}
        />
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">任意入力（詳細情報）</p>
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
            <Label htmlFor="event_start_time">稼働開始時刻</Label>
            <Input id="event_start_time" name="event_start_time" type="time" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_end_time">稼働終了時刻</Label>
            <Input id="event_end_time" name="event_end_time" type="time" />
          </div>
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
