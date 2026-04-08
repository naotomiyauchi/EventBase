import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { billingToPdfBuffer, billingToXlsxBuffer } from "@/lib/billing-export";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "pdf").toLowerCase();

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: doc } = await supabase
    .from("billing_documents")
    .select(
      `
      id, kind, doc_no, issue_date, due_date, recipient_name, recipient_email,
      subtotal, tax_rate, tax_amount, total_amount, note,
      agencies ( name ),
      projects ( title )
    `
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
    recipient_email: doc.recipient_email,
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

  if (format === "xlsx") {
    const buf = await billingToXlsxBuffer(payload, linePayload);
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${payload.doc_no}.xlsx"`,
      },
    });
  }

  const pdf = await billingToPdfBuffer(payload, linePayload);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payload.doc_no}.pdf"`,
    },
  });
}

