import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import {
  financeToPdfBuffer,
  financeToXlsxBuffer,
  type FinanceCashbookExportRow,
  type FinanceReceiptExportRow,
} from "@/lib/finance-export";

function toMonthRange(ym: string) {
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
  const month =
    url.searchParams.get("month") ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { start, end } = toMonthRange(month);
  const [{ data: receipts }, { data: cashbook }] = await Promise.all([
    supabase
      .from("finance_receipts")
      .select(
        `
        expense_date, vendor, category, payment_method, amount, tax_amount, memo,
        projects ( title ),
        agencies ( name )
      `
      )
      .gte("expense_date", start)
      .lt("expense_date", end)
      .order("expense_date", { ascending: false }),
    supabase
      .from("finance_cashbook_entries")
      .select("entry_date, entry_type, account, category, description, amount")
      .gte("entry_date", start)
      .lt("entry_date", end)
      .order("entry_date", { ascending: false }),
  ]);

  const receiptRows = ((receipts ?? []) as unknown as Array<
    Omit<FinanceReceiptExportRow, "project_title" | "agency_name"> & {
      projects: { title?: string }[] | null;
      agencies: { name?: string }[] | null;
    }
  >).map((r) => ({
    expense_date: r.expense_date,
    vendor: r.vendor,
    category: r.category,
    payment_method: r.payment_method,
    amount: Number(r.amount ?? 0),
    tax_amount: Number(r.tax_amount ?? 0),
    project_title: r.projects?.[0]?.title ?? null,
    agency_name: r.agencies?.[0]?.name ?? null,
    memo: r.memo,
  }));

  const cashbookRows = (cashbook ?? []) as FinanceCashbookExportRow[];

  if (format === "pdf") {
    const pdf = await financeToPdfBuffer({
      monthLabel: month,
      receipts: receiptRows,
      cashbook: cashbookRows,
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="finance-${month}.pdf"`,
      },
    });
  }

  const xlsx = await financeToXlsxBuffer({
    monthLabel: month,
    receipts: receiptRows,
    cashbook: cashbookRows,
  });
  return new NextResponse(xlsx, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance-${month}.xlsx"`,
    },
  });
}
