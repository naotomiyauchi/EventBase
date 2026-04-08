const DEFAULT_TZ = "Asia/Tokyo";

function calendarInTimeZone(isoInstant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(isoInstant);
  const get = (type: Intl.DateTimeFormatPart["type"]) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** 生年月日（YYYY-MM-DD）から満年齢。サーバー/クライアントで同じ TZ の暦日を使いハイドレーション差を防ぐ */
export function computeAgeFromBirthDate(
  isoDate: string | null | undefined,
  timeZone = DEFAULT_TZ
): number | null {
  if (!isoDate || !String(isoDate).trim()) return null;
  const raw = String(isoDate).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const birthY = Number(match[1]);
  const birthM = Number(match[2]);
  const birthD = Number(match[3]);
  if (
    Number.isNaN(birthY) ||
    Number.isNaN(birthM) ||
    Number.isNaN(birthD) ||
    birthM < 1 ||
    birthM > 12 ||
    birthD < 1 ||
    birthD > 31
  ) {
    return null;
  }

  const t = calendarInTimeZone(new Date(), timeZone);
  if (Number.isNaN(t.y) || Number.isNaN(t.m) || Number.isNaN(t.d)) return null;

  let age = t.y - birthY;
  if (t.m < birthM || (t.m === birthM && t.d < birthD)) age--;
  return age;
}
