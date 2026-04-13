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
  const m = t.match(/^(希望休|NG)\s+(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
  if (!m) return null;
  return { date: m[2], reason: m[3]?.trim() ?? null };
}

export function parseLinkCommand(text: string): { email: string } | null {
  const t = text.trim();
  const m = t.match(/^連携\s+([^\s]+@[^\s]+)$/);
  if (!m) return null;
  return { email: m[1].toLowerCase() };
}
