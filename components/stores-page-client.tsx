"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { createStore, deleteStore, updateStore } from "@/app/actions/stores";

type AgencyOption = { id: string; name: string; carrierName: string | null };

export type StoreRow = {
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

function AgencySelect({
  agencies,
  defaultValue,
  disabled,
}: {
  agencies: AgencyOption[];
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <select
      name="agency_id"
      required
      disabled={disabled}
      defaultValue={defaultValue ?? ""}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>
        選択してください
      </option>
      {agencies.map((a) => (
        <option key={a.id} value={a.id}>
          {(a.carrierName ? `${a.carrierName} / ` : "") + a.name}
        </option>
      ))}
    </select>
  );
}

function StoreFormFields({
  agencies,
  defaults,
  disabled,
}: {
  agencies: AgencyOption[];
  defaults?: Partial<StoreRow>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>代理店</Label>
        <AgencySelect
          agencies={agencies}
          defaultValue={defaults?.agency_id}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">店舗名</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="〇〇店"
          defaultValue={defaults?.name ?? ""}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">住所</Label>
        <Input
          id="address"
          name="address"
          placeholder="都道府県から"
          defaultValue={defaults?.address ?? ""}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access_notes">アクセス</Label>
        <Textarea
          id="access_notes"
          name="access_notes"
          rows={2}
          defaultValue={defaults?.access_notes ?? ""}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_name">担当者名</Label>
          <Input
            id="contact_name"
            name="contact_name"
            defaultValue={defaults?.contact_name ?? ""}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">電話</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            defaultValue={defaults?.contact_phone ?? ""}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="entry_rules">入館・注意事項</Label>
        <Textarea
          id="entry_rules"
          name="entry_rules"
          rows={3}
          defaultValue={defaults?.entry_rules ?? ""}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function StoresPageClient({
  stores,
  agencies,
  canMutate,
}: {
  stores: StoreRow[];
  agencies: AgencyOption[];
  canMutate: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<StoreRow | null>(null);

  const selectedAgencyLabel = useMemo(() => {
    if (!selected) return "";
    const carrier = selected.agencies?.carriers?.name ?? "";
    const agency = selected.agencies?.name ?? "";
    return `${carrier} ${agency}`.trim() || "—";
  }, [selected]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">登録済み</h2>
        <Button onClick={() => setCreateOpen(true)} disabled={!canMutate}>
          イベントを追加
        </Button>
      </div>

      {stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだありません。マスタで代理店を追加してください。
        </p>
      ) : (
        <div className="grid gap-3">
          {stores.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <CardDescription>
                      {r.agencies?.carriers?.name} {r.agencies?.name}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                    >
                      <span className="sr-only">メニュー</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelected(r);
                          setDetailOpen(true);
                        }}
                      >
                        詳細
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelected(r);
                          setEditOpen(true);
                        }}
                      >
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setSelected(r);
                          setDeleteOpen(true);
                        }}
                      >
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {r.address && <p>{r.address}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>イベントを追加</DialogTitle>
            <DialogDescription>
              代理店を選択して店舗情報を入力します。
            </DialogDescription>
          </DialogHeader>
          <form action={createStore} className="space-y-4">
            <StoreFormFields agencies={agencies} disabled={!canMutate} />
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={!canMutate}>
                登録
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>イベント詳細</DialogTitle>
            <DialogDescription>登録済みのイベント情報です。</DialogDescription>
          </DialogHeader>
          {!selected ? (
            <p className="text-sm text-muted-foreground">イベントが選択されていません。</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">店舗名</p>
                <p className="font-medium">{selected.name}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">代理店</p>
                <p className="font-medium">{selectedAgencyLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">住所</p>
                <p className="font-medium">{selected.address ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">アクセス</p>
                <p className="whitespace-pre-wrap">
                  {selected.access_notes ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">担当者</p>
                <p className="font-medium">
                  {(selected.contact_name ?? "—") +
                    (selected.contact_phone ? ` / ${selected.contact_phone}` : "")}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">入館・注意事項</p>
                <p className="whitespace-pre-wrap">
                  {selected.entry_rules ?? "—"}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false);
                    setEditOpen(true);
                  }}
                >
                  編集
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>イベントを編集</DialogTitle>
            <DialogDescription>店舗情報を更新します。</DialogDescription>
          </DialogHeader>
          {!selected ? (
            <p className="text-sm text-muted-foreground">イベントが選択されていません。</p>
          ) : (
            <form action={updateStore} className="space-y-4">
              <input type="hidden" name="id" value={selected.id} />
              <StoreFormFields
                agencies={agencies}
                defaults={selected}
                disabled={!canMutate}
              />
              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={!canMutate}>
                  保存
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>削除の確認</DialogTitle>
            <DialogDescription>
              イベントを削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          {!selected ? (
            <p className="text-sm text-muted-foreground">イベントが選択されていません。</p>
          ) : (
            <form action={deleteStore} className="space-y-3">
              <input type="hidden" name="id" value={selected.id} />
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAgencyLabel}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDeleteOpen(false)}>
                  キャンセル
                </Button>
                <Button variant="destructive" type="submit" disabled={!canMutate}>
                  削除する
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

