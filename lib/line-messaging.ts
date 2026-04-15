import crypto from "node:crypto";
import sharp from "sharp";

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

async function lineApi(
  path: string,
  init: { method: string; body?: unknown }
): Promise<{ ok: boolean; json: Record<string, unknown>; text: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, json: {}, text: "LINE_CHANNEL_ACCESS_TOKEN missing" };
  const res = await fetch(`https://api.line.me${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  return { ok: res.ok, json, text };
}

/** LINE 要件: リッチメニュー作成後、サイズ一致の JPEG/PNG を api-data にアップロードしてから既定化する */
async function buildDefaultRichMenuImage(): Promise<Buffer> {
  const w = 2500;
  const h = 1686;
  const wCol = Math.floor(w / 3);
  const wMid = w - 2 * wCol;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${wCol}" height="${h}" fill="#dbeafe"/>
    <rect x="${wCol}" width="${wMid}" height="${h}" fill="#fce7f3"/>
    <rect x="${wCol + wMid}" width="${wCol}" height="${h}" fill="#d1fae5"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function uploadRichMenuImage(
  richMenuId: string,
  image: Buffer
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN missing" };
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/png",
    },
    body: new Uint8Array(image),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t || `upload HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function createDefaultRichMenu(): Promise<{ ok: boolean; richMenuId?: string; error?: string }> {
  const menu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "EventBase Menu",
    chatBarText: "EventBaseメニュー",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 1686 },
        action: { type: "message", text: "連携設定" },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 1686 },
        action: { type: "message", text: "希望休入力" },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 1686 },
        action: { type: "message", text: "使い方" },
      },
    ],
  };

  const created = await lineApi("/v2/bot/richmenu", { method: "POST", body: menu });
  if (!created.ok) return { ok: false, error: created.text };
  const richMenuId = String(created.json.richMenuId ?? "");
  if (!richMenuId) return { ok: false, error: "richMenuId_missing" };

  let png: Buffer;
  try {
    png = await buildDefaultRichMenuImage();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `rich_menu_image_build:${msg}` };
  }

  const uploaded = await uploadRichMenuImage(richMenuId, png);
  if (!uploaded.ok) return { ok: false, error: uploaded.error ?? "rich_menu_image_upload_failed" };

  const setDefault = await lineApi(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
  if (!setDefault.ok) return { ok: false, error: setDefault.text };

  return { ok: true, richMenuId };
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

export function normalizeModeTrigger(text: string): "receipt_mode" | "holiday_mode" | "help" | "end" | null {
  const t = text.trim();
  if (["領収書", "receipt", "レシート"].includes(t)) return "receipt_mode";
  if (["希望休", "休み", "シフト", "希望休入力"].includes(t)) return "holiday_mode";
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
