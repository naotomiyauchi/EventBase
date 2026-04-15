import { NextResponse } from "next/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  fetchLineImageContent,
  isLineConfigured,
  normalizeModeTrigger,
  parseLinkCommand,
  parseUnavailableCommand,
  replyLineMessage,
  verifyLineSignature,
} from "@/lib/line-messaging";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { id?: string; type?: string; text?: string };
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
    const msgType = ev.message?.type ?? "";
    const text = msgType === "text" ? ev.message?.text?.trim() ?? "" : "";
    const messageId = ev.message?.id ?? null;
    let status = "ok";
    let note: string | null = null;
    let tenantId: string | null = null;

    try {
      if (ev.type === "message" && userId) {
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

        const trigger = msgType === "text" ? normalizeModeTrigger(text) : null;

        if (trigger === "end") {
          if (tenantId) {
            await admin
              .from("line_input_sessions")
              .delete()
              .eq("tenant_id", tenantId)
              .eq("line_user_id", userId);
          }
          if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "入力モードを終了しました。");
            replied = true;
          }
        }

        /** Staff sends exact text 「シフト」 → app notification for managers */
        if (!replied && text === "シフト") {
          const { data: shiftLink } = await admin
            .from("line_user_links")
            .select("staff_id, tenant_id, staff ( name )")
            .eq("line_user_id", userId)
            .maybeSingle();
          if (shiftLink?.staff_id && shiftLink.tenant_id) {
            tenantId = shiftLink.tenant_id;
            const st = Array.isArray(shiftLink.staff) ? shiftLink.staff[0] : shiftLink.staff;
            const staffName = st?.name ?? "スタッフ";
            await admin.from("app_notifications").insert({
              tenant_id: shiftLink.tenant_id,
              type: "line_shift_inquiry",
              title: "LINEから「シフト」の問い合わせ",
              body: `${staffName}さんが「シフト」と送信しました。`,
              metadata: {
                staff_id: shiftLink.staff_id,
                line_user_id: userId,
              },
            });
            if (ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                "受け付けました。担当者に通知しています。のちほど管理画面の「通知」でご確認ください。"
              );
              replied = true;
            }
          } else if (ev.replyToken) {
            await replyLineMessage(
              ev.replyToken,
              "先にメールアドレスで連携を完了してください。（「連携設定」から）"
            );
            replied = true;
          }
        }

        if (!replied && (text === "連携設定" || (activeSession == null && msgType === "text" && parseLinkCommand(text)))) {
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

        if (!replied && trigger === "holiday_mode") {
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

        if (!replied && trigger === "receipt_mode") {
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
                mode: "receipt_mode",
                status: "awaiting_input",
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
              },
              { onConflict: "tenant_id,line_user_id" }
            );
            if (ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                "領収書モードに入りました。画像を送信してください。\n終了は「完了」です。"
              );
              replied = true;
            }
          } else if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "先に「連携 メールアドレス」を送信してください。");
            replied = true;
          }
        }

        if (!replied && trigger === "help" && ev.replyToken) {
          await replyLineMessage(
            ev.replyToken,
            "使い方:\n1) 連携設定 でメール連携\n2) 希望休入力 で日付を送信（例: 2026-04-30 私用）\n3) 「シフト」と送ると担当者へ通知されます"
          );
          replied = true;
        }

        if (!replied && activeSession?.mode === "link" && msgType === "text") {
          const lc = parseLinkCommand(text);
          if (!lc && ev.replyToken) {
            await replyLineMessage(ev.replyToken, "メール形式で入力してください。例: staff@example.com");
            replied = true;
          }
        }
        const link = parseLinkCommand(text);
        if (!replied && msgType === "text" && link) {
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

        const off = msgType === "text" ? parseUnavailableCommand(text) : null;
        if (
          !replied &&
          off &&
          (activeSession?.mode === "holiday_mode" ||
            activeSession?.mode === "unavailable" ||
            trigger === "holiday_mode" ||
            text.startsWith("希望休") ||
            /^\d{4}-\d{2}-\d{2}/.test(text))
        ) {
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
            await admin.from("app_notifications").insert({
              tenant_id: linkRow.tenant_id,
              type: "line_holiday_added",
              title: "LINE希望休が追加されました",
              body: `スタッフID ${linkRow.staff_id} が ${off.date} の希望休を追加`,
              metadata: { staff_id: linkRow.staff_id, date: off.date, reason: off.reason },
            });
          } else if (ev.replyToken) {
            await replyLineMessage(ev.replyToken, "先に「連携 メールアドレス」を送信して連携してください。");
            replied = true;
          }
        }

        if (!replied && msgType === "image" && messageId && activeSession?.mode === "receipt_mode") {
          const { data: linkRow } = await admin
            .from("line_user_links")
            .select("staff_id, tenant_id")
            .eq("line_user_id", userId)
            .maybeSingle();
          if (linkRow?.tenant_id && linkRow.staff_id) {
            tenantId = linkRow.tenant_id;
            const image = await fetchLineImageContent(messageId);
            if (image) {
              const filePath = `${tenantId}/line-receipts/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${messageId}.jpg`;
              const { error: upErr } = await admin.storage
                .from("receipt-files")
                .upload(filePath, image, { contentType: "image/jpeg", upsert: false });
              if (!upErr) {
                const today = new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Tokyo",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(new Date());
                await admin.from("finance_receipts").insert({
                  tenant_id: tenantId,
                  expense_date: today,
                  category: "other",
                  payment_method: "cash",
                  amount: 0,
                  tax_amount: 0,
                  memo: "LINEアップロード領収書（金額未入力）",
                  file_path: filePath,
                  created_by: null,
                });
                await admin.from("app_notifications").insert({
                  tenant_id: tenantId,
                  type: "line_receipt_uploaded",
                  title: "LINE領収書がアップロードされました",
                  body: `スタッフID ${linkRow.staff_id} が領収書画像をアップロード`,
                  metadata: { staff_id: linkRow.staff_id, file_path: filePath },
                });
                if (ev.replyToken) {
                  await replyLineMessage(
                    ev.replyToken,
                    "領収書画像を登録しました。続けて送る場合は画像を送信、終了は「完了」です。"
                  );
                  replied = true;
                }
              } else if (ev.replyToken) {
                await replyLineMessage(ev.replyToken, `保存に失敗しました: ${upErr.message}`);
                replied = true;
              }
            } else if (ev.replyToken) {
              await replyLineMessage(ev.replyToken, "画像の取得に失敗しました。再送してください。");
              replied = true;
            }
          }
        }

        if (!replied && msgType === "image" && !activeSession && ev.replyToken) {
          await replyLineMessage(
            ev.replyToken,
            "画像の用途が未選択です。先に「領収書」と送信してから画像を送ってください。"
          );
          replied = true;
        }

        if (!replied && ev.replyToken) {
          await replyLineMessage(
            ev.replyToken,
            "受付コマンド:\n1) 連携 メールアドレス\n2) 「シフト」（担当者へ通知）\n3) 領収書（画像受付）\n4) 希望休 YYYY-MM-DD 理由\n例) 希望休 2026-04-30 私用"
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
