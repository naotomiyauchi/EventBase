import { NextResponse } from "next/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  isLineConfigured,
  parseLinkCommand,
  parseUnavailableCommand,
  replyLineMessage,
  verifyLineSignature,
} from "@/lib/line-messaging";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
};

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!isLineConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ ok: false, error: "line_not_configured" }, { status: 503 });
  }
  if (!verifyLineSignature(raw, sig)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = (JSON.parse(raw) as { destination?: string; events?: LineEvent[] }) ?? {};
  const events = payload.events ?? [];
  const admin = createServiceRoleClient();

  for (const ev of events) {
    const userId = ev.source?.userId ?? null;
    const text = ev.message?.type === "text" ? ev.message.text?.trim() ?? "" : "";
    let status = "ok";
    let note: string | null = null;
    let tenantId: string | null = null;

    try {
      if (ev.type === "message" && userId && text) {
        let replied = false;
        let activeSession:
          | { id: string; mode: string; tenant_id: string; expires_at: string }
          | null = null;
        const { data: linkedTenant } = await admin
          .from("line_user_links")
          .select("tenant_id")
          .eq("line_user_id", userId)
          .maybeSingle();
        if (linkedTenant?.tenant_id) {
          tenantId = linkedTenant.tenant_id;
          const { data: session } = await admin
            .from("line_input_sessions")
            .select("id, mode, tenant_id, expires_at")
            .eq("tenant_id", linkedTenant.tenant_id)
            .eq("line_user_id", userId)
            .eq("status", "awaiting_input")
            .maybeSingle();
          if (session && new Date(session.expires_at).getTime() > Date.now()) {
            activeSession = session;
          }
        }

        if (text === "連携設定") {
          if (tenantId) {
            await admin.from("line_input_sessions").upsert(
              {
                tenant_id: tenantId,
                line_user_id: userId,
                mode: "link",
                status: "awaiting_input",
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
              { onConflict: "tenant_id,line_user_id" }
            );
          }
          if (ev.replyToken) {
            await replyLineMessage(
              ev.replyToken,
              "連携したいメールアドレスを送信してください。\n例: naotomiyauchi.1207@gmail.com\n（初回はこの入力だけで連携できます）"
            );
            replied = true;
          }
        }

        if (!replied && text === "希望休入力") {
          if (!tenantId) {
            const { data: anyLink } = await admin
              .from("line_user_links")
              .select("tenant_id")
              .eq("line_user_id", userId)
              .maybeSingle();
            tenantId = anyLink?.tenant_id ?? null;
          }
          if (tenantId) {
            await admin.from("line_input_sessions").upsert(
              {
                tenant_id: tenantId,
                line_user_id: userId,
                mode: "unavailable",
                status: "awaiting_input",
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
              { onConflict: "tenant_id,line_user_id" }
            );
            if (ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                "希望休を入力してください。\n例: 2026-04-30 私用"
              );
              replied = true;
            }
          } else if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "先に「連携 メールアドレス」を送信してください。");
            replied = true;
          }
        }

        if (!replied && text === "使い方" && ev.replyToken) {
          await replyLineMessage(
            ev.replyToken,
            "使い方:\n1) 連携設定 を押してメール連携\n2) 希望休入力 で日付を送信\n例: 希望休 2026-04-30 私用"
          );
          replied = true;
        }

        if (!replied && activeSession?.mode === "link") {
          const lc = parseLinkCommand(text);
          if (!lc && ev.replyToken) {
            await replyLineMessage(ev.replyToken, "メール形式で入力してください。例: staff@example.com");
            replied = true;
          }
        }
        const link = parseLinkCommand(text);
        if (!replied && link) {
          const { data: staff } = await admin
            .from("staff")
            .select("id, tenant_id, name, email")
            .eq("email", link.email)
            .maybeSingle();
          if (staff?.id && staff.tenant_id) {
            tenantId = staff.tenant_id;
            await admin.from("line_user_links").upsert(
              {
                tenant_id: staff.tenant_id,
                staff_id: staff.id,
                line_user_id: userId,
                line_display_name: staff.name ?? null,
              },
              { onConflict: "tenant_id,line_user_id" }
            );
            if (ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                `連携完了: ${staff.name ?? staff.email ?? "スタッフ"}\n希望休は「希望休 YYYY-MM-DD 理由」で送信してください。`
              );
              replied = true;
            }
            await admin
              .from("line_input_sessions")
              .delete()
              .eq("tenant_id", staff.tenant_id)
              .eq("line_user_id", userId);
          } else if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "連携対象のスタッフメールが見つかりませんでした。");
            replied = true;
          }
        }

        const off = parseUnavailableCommand(text);
        if (!replied && off) {
          const { data: linkRow } = await admin
            .from("line_user_links")
            .select("staff_id, tenant_id")
            .eq("line_user_id", userId)
            .maybeSingle();
          if (linkRow?.staff_id && linkRow.tenant_id) {
            tenantId = linkRow.tenant_id;
            const { error } = await admin.from("staff_unavailable_dates").upsert(
              {
                staff_id: linkRow.staff_id,
                tenant_id: linkRow.tenant_id,
                unavailable_date: off.date,
                reason: off.reason,
              },
              { onConflict: "staff_id,unavailable_date" }
            );
            if (error) {
              status = "error";
              note = error.message;
            }
            if (ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                error
                  ? "希望休の登録に失敗しました。形式を確認して再送してください。"
                  : `希望休を登録しました: ${off.date}${off.reason ? ` (${off.reason})` : ""}`
              );
              replied = true;
            }
            await admin
              .from("line_input_sessions")
              .delete()
              .eq("tenant_id", linkRow.tenant_id)
              .eq("line_user_id", userId);
          } else if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "先に「連携 メールアドレス」を送信して連携してください。");
            replied = true;
          }
        }

        if (!replied && ev.replyToken) {
          await replyLineMessage(
            ev.replyToken,
            "受付コマンド:\n1) 連携 メールアドレス\n2) 希望休 YYYY-MM-DD 理由\n例) 希望休 2026-04-30 私用"
          );
        }
      }
    } catch (e) {
      status = "error";
      note = e instanceof Error ? e.message : "unknown_error";
    }

    await admin.from("line_webhook_logs").insert({
      tenant_id: tenantId,
      event_type: ev.type ?? "unknown",
      line_user_id: userId,
      payload: ev as unknown as Record<string, unknown>,
      status,
      note,
    });
  }

  return NextResponse.json({ ok: true });
}
