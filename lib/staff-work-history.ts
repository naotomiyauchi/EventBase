export type WorkHistoryInput = {
  year: number | null;
  month: number | null;
  period_label: string | null;
  job_content: string | null;
};

export function parseWorkHistoryJson(raw: string | null | undefined): WorkHistoryInput[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const o = row as Record<string, unknown>;
      const y = o.year;
      const m = o.month;
      return {
        year: typeof y === "number" && Number.isFinite(y) ? y : null,
        month: typeof m === "number" && Number.isFinite(m) ? m : null,
        period_label:
          typeof o.period_label === "string" ? o.period_label : null,
        job_content:
          typeof o.job_content === "string" ? o.job_content : null,
      };
    });
  } catch {
    return [];
  }
}

export function workHistoryToRowsForEditor(
  rows: { year: number | null; month: number | null; period_label: string | null; job_content: string | null }[]
) {
  return rows.map((r) => ({
    year: r.year != null ? String(r.year) : "",
    month: r.month != null ? String(r.month) : "",
    period_label: r.period_label ?? "",
    job_content: r.job_content ?? "",
  }));
}
