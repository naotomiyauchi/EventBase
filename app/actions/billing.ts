"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";
import { billingToPdfBuffer } from "@/lib/billing-export";

function ymRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const end = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(next);
  return { start, end };
}

function calcTax(subtotal: number, taxRate: number) {
  const tax = Math.round((subtotal * taxRate) / 100);
  return { tax, total: subtotal + tax };
}

async function recalcDocumentTotals(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  const { data: lines } = await supabase
    .from("billing_document_lines")
    .select("amount")
    .eq("document_id", documentId);
  const subtotal = (lines ?? []).reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const { data: doc } = await supabase
    .from("billing_documents")
    .select("tax_rate")
    .eq("id", documentId)
    .maybeSingle();
  const taxRate = Number(doc?.tax_rate ?? 10);
  const { tax, total } = calcTax(subtotal, taxRate);
  await supabase
    .from("billing_documents")
    .update({ subtotal, tax_amount: tax, total_amount: total })
    .eq("id", documentId);
}

export async function generateBillingDraftAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/billing?error=forbidden");
  }

  const mode = String(formData.get("mode") ?? "project").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const agencyId = String(formData.get("agency_id") ?? "").trim();
  const targetMonth = String(formData.get("target_month") ?? "").trim();
  const taxRate = Number(String(formData.get("tax_rate") ?? "10"));
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "invoice").trim() as "invoice" | "estimate";

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const docNo = `${kind === "invoice" ? "INV" : "EST"}-${today.replaceAll("-", "")}-${Math.floor(
    Math.random() * 10000
  )
    .toString()
    .padStart(4, "0")}`;

  let rows: {
    project_id: string;
    project_title: string;
    shift_count: number;
    unit_price: number;
    expense_total: number;
    agency_id: string | null;
  }[] = [];

  if (mode === "project") {
    if (!projectId) redirect("/dashboard/billing?error=project_required");
    const { data } = await supabase.rpc("generate_project_billing_rows", { p_project_id: projectId });
    rows = ((data ?? []) as typeof rows).filter((r) => r.shift_count > 0 || r.expense_total > 0);
  } else {
    if (!agencyId || !targetMonth) redirect("/dashboard/billing?error=agency_month_required");
    const { start, end } = ymRange(targetMonth);
    const { data } = await supabase.rpc("generate_agency_month_billing_rows", {
      p_agency_id: agencyId,
      p_start: start,
      p_end: end,
    });
    rows = ((data ?? []) as typeof rows).filter((r) => r.shift_count > 0 || r.expense_total > 0);
  }

  if (rows.length === 0) {
    redirect("/dashboard/billing?error=no_billable_rows");
  }

  const lineRows = rows.flatMap((r, idx) => {
    const shiftAmount = Math.round(r.shift_count * Number(r.unit_price ?? 0));
    const expenseAmount = Math.round(Number(r.expense_total ?? 0));
    const lines: {
      sort_order: number;
      line_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
      project_id: string;
    }[] = [];
    if (shiftAmount > 0) {
      lines.push({
        sort_order: idx * 10 + 1,
        line_type: "shift",
        description: `${r.project_title} / 稼働費`,
        quantity: r.shift_count,
        unit_price: r.unit_price,
        amount: shiftAmount,
        project_id: r.project_id,
      });
    }
    if (expenseAmount > 0) {
      lines.push({
        sort_order: idx * 10 + 2,
        line_type: "expense",
        description: `${r.project_title} / 交通費・経費`,
        quantity: 1,
        unit_price: expenseAmount,
        amount: expenseAmount,
        project_id: r.project_id,
      });
    }
    return lines;
  });

  const baseAgencyId = mode === "project" ? rows[0]?.agency_id ?? null : agencyId;
  let calculatedLines = [...lineRows];

  if (baseAgencyId) {
    const { data: agency } = await supabase
      .from("agencies")
      .select("fee_rate")
      .eq("id", baseAgencyId)
      .maybeSingle();
    const feeRate = Number(agency?.fee_rate ?? 0);
    if (Number.isFinite(feeRate) && feeRate > 0) {
      const baseAmount = calculatedLines.reduce((s, l) => s + l.amount, 0);
      const feeAmount = Math.round((baseAmount * feeRate) / 100);
      if (feeAmount > 0) {
        calculatedLines.push({
          sort_order: 9990,
          line_type: "agency_fee",
          description: `代理店手数料 (${feeRate}%)`,
          quantity: 1,
          unit_price: feeAmount,
          amount: feeAmount,
          project_id: rows[0]?.project_id ?? projectId,
        });
      }
    }
  }

  const subtotal = calculatedLines.reduce((s, l) => s + l.amount, 0);
  const { tax, total } = calcTax(subtotal, Number.isFinite(taxRate) ? taxRate : 10);

  const { data: inserted, error } = await supabase
    .from("billing_documents")
    .insert({
      kind,
      status: "draft",
      doc_no: docNo,
      agency_id: baseAgencyId,
      project_id: mode === "project" ? projectId : null,
      period_start: mode === "project" ? null : ymRange(targetMonth).start,
      period_end: mode === "project" ? null : ymRange(targetMonth).end,
      issue_date: today,
      due_date: dueDate,
      subtotal,
      tax_rate: taxRate,
      tax_amount: tax,
      total_amount: total,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(error?.message ?? "insert_failed")}`);
  }

  const { error: lineError } = await supabase.from("billing_document_lines").insert(
    calculatedLines.map((l) => ({
      document_id: inserted.id,
      ...l,
    }))
  );
  if (lineError) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(lineError.message)}`);
  }

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?draft_created=1");
}

export async function updateBillingStatusAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/billing?error=forbidden");
  }
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) {
    redirect("/dashboard/billing?error=invalid");
  }
  const { error } = await supabase.from("billing_documents").update({ status }).eq("id", id);
  if (error) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?status_updated=1");
}

export async function addCustomBillingLineAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/billing?error=forbidden");
  }
  const documentId = String(formData.get("document_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const quantity = Number(String(formData.get("quantity") ?? "1"));
  const unitPrice = Number(String(formData.get("unit_price") ?? "0"));
  if (!documentId || !description) {
    redirect("/dashboard/billing?error=line_required");
  }
  const q = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const u = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  const amount = Math.round(q * u);
  const { error } = await supabase.from("billing_document_lines").insert({
    document_id: documentId,
    line_type: "custom",
    description,
    quantity: q,
    unit_price: u,
    amount,
    sort_order: Math.floor(Math.random() * 100000),
  });
  if (error) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(error.message)}`);
  }
  await recalcDocumentTotals(supabase, documentId);
  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?line_added=1");
}

export async function approveEstimateAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/billing?error=forbidden");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/dashboard/billing?error=invalid");

  const { data: doc } = await supabase
    .from("billing_documents")
    .select("id, kind, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.kind !== "estimate") {
    redirect("/dashboard/billing?error=estimate_only");
  }

  const now = new Date().toISOString();
  await supabase
    .from("billing_documents")
    .update({
      status: "issued",
      approved_at: now,
      approved_by: profile.id,
      sign_provider: "manual",
      sign_reference: `manual-${now}`,
    })
    .eq("id", id);

  if (doc.project_id) {
    await supabase
      .from("projects")
      .update({ status: "ordered" })
      .eq("id", doc.project_id);
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/billing?estimate_approved=1");
}

export async function sendBillingEmailAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/billing?error=forbidden");
  }
  const id = String(formData.get("id") ?? "").trim();
  const toEmail = String(formData.get("to_email") ?? "").trim();
  const bccEmail = String(formData.get("bcc_email") ?? "").trim() || null;
  if (!id || !toEmail) redirect("/dashboard/billing?error=mail_required");

  const { data: doc } = await supabase
    .from("billing_documents")
    .select(
      `
      id, kind, doc_no, issue_date, due_date, recipient_name, recipient_email,
      subtotal, tax_rate, tax_amount, total_amount, note, agency_id, project_id,
      agencies ( name ),
      projects ( title )
      `
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc) redirect("/dashboard/billing?error=doc_not_found");

  const { data: lines } = await supabase
    .from("billing_document_lines")
    .select("sort_order, description, quantity, unit_price, amount")
    .eq("document_id", id)
    .order("sort_order", { ascending: true });

  const payload = {
    id: doc.id,
    kind: doc.kind as "invoice" | "estimate",
    doc_no: doc.doc_no,
    issue_date: doc.issue_date,
    due_date: doc.due_date,
    recipient_name: doc.recipient_name,
    recipient_email: toEmail,
    subtotal: Number(doc.subtotal ?? 0),
    tax_rate: Number(doc.tax_rate ?? 0),
    tax_amount: Number(doc.tax_amount ?? 0),
    total_amount: Number(doc.total_amount ?? 0),
    note: doc.note,
    agency_name: (doc.agencies as { name?: string }[] | null)?.[0]?.name ?? null,
    project_title: (doc.projects as { title?: string }[] | null)?.[0]?.title ?? null,
  };
  const linePayload = (lines ?? []).map((l) => ({
    sort_order: Number(l.sort_order ?? 0),
    description: l.description ?? "",
    quantity: Number(l.quantity ?? 0),
    unit_price: Number(l.unit_price ?? 0),
    amount: Number(l.amount ?? 0),
  }));

  const pdf = await billingToPdfBuffer(payload, linePayload);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_MAIL_FROM;
  if (!apiKey || !from) {
    redirect("/dashboard/billing?error=resend_not_configured");
  }

  const subject = `${doc.kind === "invoice" ? "請求書" : "見積書"} ${doc.doc_no}`;
  const body = `${subject} をお送りします。ご確認ください。`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      bcc: bccEmail ? [bccEmail] : undefined,
      subject,
      text: body,
      attachments: [
        {
          filename: `${doc.doc_no}.pdf`,
          content: pdf.toString("base64"),
        },
      ],
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(json.message ?? "mail_send_failed")}`);
  }

  await supabase.from("billing_send_logs").insert({
    document_id: id,
    to_email: toEmail,
    bcc_email: bccEmail,
    subject,
    body,
    provider: "resend",
    provider_message_id: json.id ?? null,
    sent_by: profile.id,
    status: "sent",
  });

  await supabase
    .from("billing_documents")
    .update({
      status: "sent",
      recipient_email: toEmail,
      bcc_email: bccEmail,
    })
    .eq("id", id);

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?mail_sent=1");
}

