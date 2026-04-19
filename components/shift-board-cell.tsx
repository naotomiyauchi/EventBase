"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setShiftBoardCellAction } from "@/app/actions/shift-board";

type Props = {
  date: string; // YYYY-MM-DD (JST)
  staffId: string;
  currentProjectId: string | null;
  currentRole: "leader" | "helper" | null;
  projects: {
    id: string;
    title: string;
    related_entities: string | null;
    overview: string | null;
    event_period_start: string | null;
    event_period_end: string | null;
    assigned_staff_ids: string[] | null;
  }[];
  isUnavailable?: boolean;
  unavailableReason?: string | null;
};

export function ShiftBoardCell({
  date,
  staffId,
  currentProjectId,
  currentRole,
  projects,
  isUnavailable = false,
  unavailableReason = null,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  const candidateProjects = useMemo(
    () =>
      projects.filter((project) => {
        const isAssigned = (project.assigned_staff_ids ?? []).includes(staffId);
        const isWithinPeriod =
          (!project.event_period_start || date >= project.event_period_start) &&
          (!project.event_period_end || date <= project.event_period_end);
        return isAssigned || isWithinPeriod;
      }),
    [projects, staffId, date]
  );

  const projectMeta = (project: (typeof projects)[number] | null) => {
    const carrier = project?.related_entities?.split(" / ")[0]?.trim() || "キャリア未設定";
    const workStyle =
      project?.overview?.match(/稼働種別:\s*([^/]+)/)?.[1]?.trim() || "種別未設定";
    return { carrier, workStyle };
  };

  function submit(fd: FormData) {
    startTransition(async () => {
      await setShiftBoardCellAction(fd);
    });
  }

  const assignProject = (projectId: string) => {
    const fd = new FormData();
    fd.set("shift_date", date);
    fd.set("staff_id", staffId);
    fd.set("project_id", projectId);
    fd.set("role", currentRole ?? "helper");
    submit(fd);
  };

  const clearProject = () => {
    const fd = new FormData();
    fd.set("shift_date", date);
    fd.set("staff_id", staffId);
    fd.set("project_id", "");
    submit(fd);
  };

  const { carrier: currentCarrier, workStyle: currentWorkStyle } = projectMeta(currentProject);

  useEffect(() => {
    if (!isPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isPickerOpen]);

  return (
    <div ref={rootRef} className="relative">
      <div
        onClick={() => {
          if (!currentProject) {
            setIsPickerOpen((prev) => !prev);
          }
        }}
        className={`min-h-[92px] rounded-xl border p-2 transition-all ${
          isUnavailable
            ? "cursor-pointer border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
            : currentProject
              ? "border-primary/30 bg-background shadow-sm"
              : "cursor-pointer border-dashed border-border bg-background/80 hover:border-primary/30 hover:bg-background"
        }`}
      >
        {isUnavailable ? (
          currentProject ? (
            <div className="space-y-2">
              <p className="truncate text-xs font-semibold leading-4">
                {currentProject.title}
              </p>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[11px] text-red-700 dark:text-red-300">
                  {currentCarrier}
                </p>
                <span className="shrink-0 text-[11px] text-red-700 dark:text-red-300">
                  {currentWorkStyle}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={clearProject}
                  className="shrink-0 rounded-full border border-red-500/40 bg-red-500 px-2 py-0.5 text-[10px] text-white transition-colors hover:bg-red-500/90"
                >
                  解除
                </button>
              </div>
              <p className="text-[10px] text-red-700 dark:text-red-300">
                希望休{unavailableReason ? `: ${unavailableReason}` : ""}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-[76px] items-center justify-center rounded-lg border border-red-300 bg-red-100/70 px-2 text-center text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              希望休{unavailableReason ? `: ${unavailableReason}` : ""} / クリックで候補案件を表示
            </div>
          )
        ) : currentProject ? (
          <div className="space-y-2">
            <p className="truncate text-xs font-semibold leading-4">
              {currentProject.title}
            </p>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {currentCarrier}
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{currentWorkStyle}</span>
              <button
                type="button"
                disabled={pending}
                onClick={clearProject}
                className="shrink-0 rounded-full border border-red-500/40 bg-red-500 px-2 py-0.5 text-[10px] text-white transition-colors hover:bg-red-500/90"
              >
                解除
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`flex h-full min-h-[76px] items-center justify-center rounded-lg border border-dashed px-2 text-center text-[11px] transition-all ${
              isPickerOpen
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border/80 bg-muted/20 text-muted-foreground"
            }`}
          >
            クリックして候補案件を表示
          </div>
        )}
      </div>

      {isPickerOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border bg-background p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">候補案件</p>
            <span className="text-[10px] text-muted-foreground">{candidateProjects.length}件</span>
          </div>
          {candidateProjects.length > 0 ? (
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {candidateProjects.map((project) => {
                const { carrier, workStyle } = projectMeta(project);
                const isCurrent = project.id === currentProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      assignProject(project.id);
                      setIsPickerOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-all ${
                      isCurrent
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card/40 hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-xs font-semibold">{project.title}</span>
                    <span className="mt-1 text-[11px] text-muted-foreground">{carrier}</span>
                    <span className="text-[11px] text-muted-foreground">{workStyle}</span>
                    {project.event_period_start || project.event_period_end ? (
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        {project.event_period_start ?? "?"} - {project.event_period_end ?? "?"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              このスタッフに紐づき、かつ対象日に有効な案件がありません。
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

