import { NextResponse } from "next/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  fetchLineImageContent,
  isLineConfigured,
  isLineShiftInquiryText,
  normalizeModeTrigger,
  parseLinkCodeCommand,
  parseLinkCommand,
  parseUnavailableCommand,
  replyLineMessage,
  verifyLineSignature,
} from "@/lib/line-messaging";
import { analyzeReceiptImage } from "@/lib/receipt-ocr";

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
        if (!replied && isLineShiftInquiryText(text)) {
          const { data: shiftLink, error: shiftLinkErr } = await admin
            .from("line_user_links")
            .select("staff_id, tenant_id, staff ( name )")
            .eq("line_user_id", userId)
            .maybeSingle();
          if (shiftLinkErr) {
            status = "error";
            note = `shift_link:${shiftLinkErr.message}`;
          } else if (shiftLink?.staff_id && shiftLink.tenant_id) {
            tenantId = shiftLink.tenant_id;
            const st = Array.isArray(shiftLink.staff) ? shiftLink.staff[0] : shiftLink.staff;
            const staffName = st?.name ?? "スタッフ";
            const { error: insErr } = await admin.from("app_notifications").insert({
              tenant_id: shiftLink.tenant_id,
              type: "line_shift_inquiry",
              title: "LINEから「シフト」の問い合わせ",
              body: `${staffName}さんが「シフト」と送信しました。`,
              metadata: {
                staff_id: shiftLink.staff_id,
                line_user_id: userId,
              },
            });
            if (insErr) {
              status = "error";
              note = `app_notifications:${insErr.message}`;
              if (ev.replyToken) {
                await replyLineMessage(
                  ev.replyToken,
                  "通知の保存に失敗しました。時間をおいて再度お試しください。"
                );
                replied = true;
              }
            } else if (ev.replyToken) {
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
              "連携コード（6桁）またはメールアドレスを送信してください。\n例1: 連携 123456\n例2: naotomiyauchi.1207@gmail.com"
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
            "使い方:\n1) 管理者から届いた6桁コードを「連携 123456」で送信\n2) 希望休入力 で日付を送信（例: 2026-04-30 私用）\n3) 「シフト」と送ると担当者へ通知されます"
          );
          replied = true;
        }

        if (!replied && activeSession?.mode === "link" && msgType === "text") {
          const lc = parseLinkCommand(text);
          const cc = parseLinkCodeCommand(text);
          if (!lc && !cc && ev.replyToken) {
            await replyLineMessage(
              ev.replyToken,
              "入力形式:\n1) 連携 123456（推奨）\n2) メール形式（例: staff@example.com）\n重複時は: 連携 staff@example.com elanbase"
            );
            replied = true;
          }
        }
        const linkCode = parseLinkCodeCommand(text);
        if (!replied && msgType === "text" && linkCode) {
          const nowIso = new Date().toISOString();
          const { data: codeRow, error: codeErr } = await admin
            .from("line_link_codes")
            .select("id, tenant_id, staff_id, email, expires_at, used_at, staff ( name, email )")
            .eq("code", linkCode.code)
            .is("used_at", null)
            .gt("expires_at", nowIso)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (codeErr) {
            status = "error";
            note = `line_code_lookup:${codeErr.message}`;
            if (ev.replyToken) {
              await replyLineMessage(ev.replyToken, "連携コードの照合に失敗しました。時間をおいて再度お試しください。");
              replied = true;
            }
          } else if (codeRow?.tenant_id && codeRow.staff_id) {
            tenantId = codeRow.tenant_id;
            const st = (
              Array.isArray(codeRow.staff) ? codeRow.staff[0] : codeRow.staff
            ) as { name?: string | null; email?: string | null } | null;
            const { error: upErr } = await admin.from("line_user_links").upsert(
              {
                tenant_id: codeRow.tenant_id,
                staff_id: codeRow.staff_id,
                line_user_id: userId,
                line_display_name: st?.name ?? null,
              },
              { onConflict: "tenant_id,line_user_id" }
            );
            if (upErr) {
              status = "error";
              note = `line_link_upsert_by_code:${upErr.message}`;
              if (ev.replyToken) {
                await replyLineMessage(ev.replyToken, "連携の保存に失敗しました。時間をおいて再度お試しください。");
                replied = true;
              }
            } else {
              await admin
                .from("line_link_codes")
                .update({
                  used_at: nowIso,
                  used_by_line_user_id: userId,
                })
                .eq("id", codeRow.id);
              if (ev.replyToken) {
                await replyLineMessage(
                  ev.replyToken,
                  `連携完了: ${st?.name ?? st?.email ?? codeRow.email}\n希望休は「希望休 YYYY-MM-DD 理由」で送信してください。`
                );
                replied = true;
              }
            }
          } else if (ev.replyToken) {
            await replyLineMessage(
              ev.replyToken,
              "連携コードが無効、期限切れ、または既に使用済みです。管理者へ再発行を依頼してください。"
            );
            replied = true;
          }
        }
        const link = parseLinkCommand(text);
        if (!replied && msgType === "text" && link) {
          const { data: staffRows, error: staffErr } = await admin
            .from("staff")
            .select("id, tenant_id, name, email")
            .ilike("email", link.email)
            .limit(5);
          if (staffErr) {
            status = "error";
            note = `staff_lookup:${staffErr.message}`;
            if (ev.replyToken) {
              await replyLineMessage(ev.replyToken, "連携先の検索に失敗しました。時間をおいて再度お試しください。");
              replied = true;
            }
          } else {
            const rows = staffRows ?? [];
            let tenantIdFromSlug: string | null = null;
            if (link.tenantSlug) {
              const { data: tenantRow } = await admin
                .from("tenants")
                .select("id")
                .eq("slug", link.tenantSlug)
                .maybeSingle();
              tenantIdFromSlug = tenantRow?.id ?? null;
            }
            const filteredRows = tenantIdFromSlug
              ? rows.filter((r) => r.tenant_id === tenantIdFromSlug)
              : rows;
            const staff =
              filteredRows.find((r) => (tenantId ? r.tenant_id === tenantId : false)) ??
              filteredRows[0] ??
              null;
            if (rows.length > 1 && !tenantId && !link.tenantSlug && ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                "同じメールが複数登録されています。\n「連携 メールアドレス テナントslug」で送信してください。\n例: 連携 staff@example.com elanbase"
              );
              replied = true;
            } else if (link.tenantSlug && filteredRows.length === 0 && ev.replyToken) {
              await replyLineMessage(
                ev.replyToken,
                "指定したテナントslugでスタッフが見つかりませんでした。管理者に slug を確認してください。"
              );
              replied = true;
            } else if (staff?.id && staff.tenant_id) {
              tenantId = staff.tenant_id;
              const { error: linkErr } = await admin.from("line_user_links").upsert(
                {
                  tenant_id: staff.tenant_id,
                  staff_id: staff.id,
                  line_user_id: userId,
                  line_display_name: staff.name ?? null,
                },
                { onConflict: "tenant_id,line_user_id" }
              );
              if (linkErr) {
                status = "error";
                note = `line_link_upsert:${linkErr.message}`;
                if (ev.replyToken) {
                  await replyLineMessage(ev.replyToken, "連携の保存に失敗しました。時間をおいて再度お試しください。");
                  replied = true;
                }
              } else if (ev.replyToken) {
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
              const ocr = await analyzeReceiptImage(image);
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
                  staff_id: linkRow.staff_id,
                  expense_date: ocr.inferredExpenseDate ?? today,
                  category: ocr.inferredCategory ?? "other",
                  payment_method: ocr.inferredPaymentMethod,
                  amount: ocr.inferredAmount ?? 0,
                  tax_amount: ocr.inferredTaxAmount ?? 0,
                  vendor: ocr.inferredVendor,
                  memo: ocr.rawText
                    ? `LINEアップロード領収書（OCR解析済み）\n[OCR_DEBUG] engine=${ocr.ocrEngine} text_len=${ocr.debug.rawTextLength} openai_err=${ocr.debug.openAiError ?? "-"} doc_err=${ocr.debug.documentError ?? "-"} text_err=${ocr.debug.textError ?? "-"}\n${ocr.rawText.slice(0, 1600)}`
                    : `[OCR_DEBUG] engine=${ocr.ocrEngine} text_len=0 openai_err=${ocr.debug.openAiError ?? "-"} doc_err=${ocr.debug.documentError ?? "-"} text_err=${ocr.debug.textError ?? "-"}`,
                  file_path: filePath,
                  created_by: null,
                });
                await admin.from("app_notifications").insert({
                  tenant_id: tenantId,
                  type: "line_receipt_uploaded",
                  title: "LINE領収書がアップロードされました",
                  body: `スタッフID ${linkRow.staff_id} が領収書画像をアップロード`,
                  metadata: {
                    staff_id: linkRow.staff_id,
                    file_path: filePath,
                    ocr_engine: ocr.ocrEngine,
                    ocr_debug: ocr.debug,
                    inferred_amount: ocr.inferredAmount,
                    inferred_date: ocr.inferredExpenseDate,
                    inferred_vendor: ocr.inferredVendor,
                    inferred_category: ocr.inferredCategory,
                  },
                });
                if (ev.replyToken) {
                  await replyLineMessage(
                    ev.replyToken,
                    `領収書が登録されました。${ocr.inferredAmount != null ? `金額候補: ${ocr.inferredAmount}円。` : ""}${ocr.ocrEngine === "none" ? "OCR抽出に失敗しました（管理画面メモに理由を記録）。" : ""}続けて送る場合は画像を送信、終了は「完了」です。`
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
            "受付コマンド:\n1) 連携 123456（管理者メールの6桁コード）\n2) 「シフト」（担当者へ通知）\n3) 領収書（画像受付）\n4) 希望休 YYYY-MM-DD 理由\n例) 希望休 2026-04-30 私用"
          );
        }
      }
    } catch (e) {
      status = "error";
      note = e instanceof Error ? e.message : "unknown_error";
      if (ev.replyToken) {
        try {
          await replyLineMessage(
            ev.replyToken,
            "処理中にエラーが発生しました。時間をおいて再度お試しください。"
          );
        } catch {
          // reply failure is logged via webhook note/status only
        }
      }
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
