import crypto from "node:crypto";

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);
}

export function verifyLineSignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return digest === signature;
}

export async function pushLineMessages(
  to: string[],
  messages: Array<{ type: "text"; text: string }>
): Promise<{ ok: boolean; responseText: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, responseText: "LINE_CHANNEL_ACCESS_TOKEN missing" };
  if (to.length === 0) return { ok: true, responseText: "no_targets" };

  const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, messages }),
  });
  return { ok: res.ok, responseText: await res.text() };
}

export async function replyLineMessage(
  replyToken: string,
  text: string
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

export function parseUnavailableCommand(text: string): { date: string; reason: string | null } | null {
  const t = text.trim();
  const lines = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const all = [t, ...lines];
  for (const candidate of all) {
    const m1 = candidate.match(/^(希望休|NG)\s+(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
    if (m1) return { date: m1[2], reason: m1[3]?.trim() ?? null };
    const m2 = candidate.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
    if (m2) return { date: m2[1], reason: m2[2]?.trim() ?? null };
  }
  return null;
}

export function parseLinkCommand(text: string): { email: string } | null {
  const t = text.trim();
  const m = t.match(/^連携\s+([^\s]+@[^\s]+)$/);
  if (m) return { email: m[1].toLowerCase() };
  // 名前付き入力など（例: "宮内 直人 naotomiyauchi.1207@gmail.com"）
  const e = t.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (!e) return null;
  return { email: e[1].toLowerCase() };
}

/** Normalize LINE user text (NFKC, strip zero-width) for keyword matching */
export function normalizeLineKeyword(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "");
}

/** True if user message is shift inquiry after normalization */
export function isLineShiftInquiryText(text: string): boolean {
  return normalizeLineKeyword(text) === normalizeLineKeyword("シフト");
}

export function normalizeModeTrigger(text: string): "receipt_mode" | "holiday_mode" | "help" | "end" | null {
  const t = normalizeLineKeyword(text);
  if (["領収書", "receipt", "レシート"].includes(t)) return "receipt_mode";
  if (["希望休", "休み", "希望休入力"].includes(t)) return "holiday_mode";
  if (["使い方", "help", "ヘルプ"].includes(t)) return "help";
  if (["完了", "終了", "以上", "おわり"].includes(t)) return "end";
  return null;
}

export async function fetchLineImageContent(messageId: string): Promise<Buffer | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
