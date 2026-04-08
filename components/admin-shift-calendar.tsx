"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AdminShiftCalendarShift = {
  id: string;
  projectId: string;
  time: string;
  projectTitle: string;
  staffName: string;
  siteAddress: string | null;
  unitPrice: number | null;
  requiredHeadcount: number | null;
  attendanceStatus: "not_checked_in" | "checked_in" | "checked_out";
};

export type AdminShiftCalendarDay = {
  day: number;
  dateLabel: string; // YYYY-MM-DD
  shifts: AdminShiftCalendarShift[];
};

export function AdminShiftCalendar({
  title,
  startWeekday,
  days,
}: {
  title: string;
  startWeekday: number;
  days: AdminShiftCalendarDay[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<AdminShiftCalendarDay | null>(
    null
  );
  const [projectOpen, setProjectOpen] = useState(false);
  const [selectedShift, setSelectedShift] =
    useState<AdminShiftCalendarShift | null>(null);

  const weekdayHeaders = useMemo(
    () => ["日", "月", "火", "水", "木", "金", "土"],
    []
  );

  function openDay(d: AdminShiftCalendarDay) {
    setSelectedDay(d);
    setOpen(true);
  }

  function openProject(s: AdminShiftCalendarShift) {
    setSelectedShift(s);
    setProjectOpen(true);
  }

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekdayHeaders.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div
              key={`blank-${i}`}
              className="min-h-24 rounded border bg-muted/20"
            />
          ))}
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => openDay(d)}
              className="min-h-24 rounded border p-1 text-left hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="text-xs font-medium">{d.day}</p>
              <div className="mt-1 space-y-1">
                {d.shifts.slice(0, 3).map((sft) => (
                  <p
                    key={sft.id}
                    className={[
                      "truncate rounded px-1 py-0.5 text-[10px]",
                      sft.attendanceStatus === "checked_out"
                        ? "bg-zinc-900 text-zinc-100"
                        : sft.attendanceStatus === "checked_in"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-rose-100 text-rose-900",
                    ].join(" ")}
                  >
                    {sft.staffName} / {sft.projectTitle} / {sft.time}
                  </p>
                ))}
                {d.shifts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{d.shifts.length - 3} 件
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {title} / {selectedDay?.dateLabel ?? "—"}
            </DialogTitle>
            <DialogDescription>
              その日の案件（シフト）一覧です。
            </DialogDescription>
          </DialogHeader>

          {!selectedDay || selectedDay.shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              シフトがありません。
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDay.shifts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openProject(s)}
                  className={[
                    "w-full rounded-lg border p-3 text-left hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    s.attendanceStatus === "checked_out"
                      ? "bg-zinc-900/90 text-zinc-100"
                      : s.attendanceStatus === "checked_in"
                        ? "bg-emerald-50/60"
                        : "bg-rose-50/60",
                  ].join(" ")}
                >
                  <p className="text-sm font-medium">
                    {s.staffName} / {s.projectTitle} / {s.time}
                  </p>
                  <p
                    className={[
                      "text-xs",
                      s.attendanceStatus === "checked_out"
                        ? "text-zinc-300"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.attendanceStatus === "checked_out"
                      ? "退勤済み"
                      : s.attendanceStatus === "checked_in"
                        ? "出勤済み"
                        : "未出勤"}
                  </p>
                  {s.siteAddress && (
                    <p className="text-xs text-muted-foreground">
                      住所: {s.siteAddress}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    案件詳細を表示
                  </p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>案件詳細</DialogTitle>
            <DialogDescription>
              選択した案件の情報です（簡易表示）。
            </DialogDescription>
          </DialogHeader>

          {!selectedShift ? (
            <p className="text-sm text-muted-foreground">案件が選択されていません。</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{selectedShift.projectTitle}</p>
                <p className="text-xs text-muted-foreground">
                  案件ID: {selectedShift.projectId}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">当日情報</p>
                <p>時間: {selectedShift.time}</p>
                <p>スタッフ: {selectedShift.staffName}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">案件情報</p>
                {selectedShift.siteAddress ? (
                  <p>住所: {selectedShift.siteAddress}</p>
                ) : (
                  <p className="text-muted-foreground">住所: 未設定</p>
                )}
                <p>
                  単価:{" "}
                  {selectedShift.unitPrice == null
                    ? "未設定"
                    : `${selectedShift.unitPrice.toLocaleString()}円`}
                </p>
                <p>
                  必要人数:{" "}
                  {selectedShift.requiredHeadcount == null
                    ? "未設定"
                    : `${selectedShift.requiredHeadcount}人`}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

