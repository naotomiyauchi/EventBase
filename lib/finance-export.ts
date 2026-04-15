import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";

export type FinanceReceiptExportRow = {
  expense_date: string;
  vendor: string | null;
  category: string | null;
  payment_method: string | null;
  amount: number;
  tax_amount: number;
  project_title: string | null;
  agency_name: string | null;
  memo: string | null;
};

export type FinanceCashbookExportRow = {
  entry_date: string;
  entry_type: "income" | "expense" | "adjustment";
  account: string;
  category: string | null;
  description: string | null;
  amount: number;
};

function yen(v: number) {
  return Math.round(v).toLocaleString("ja-JP");
}

export async function financeToXlsxBuffer(input: {
  monthLabel: string;
  receipts: FinanceReceiptExportRow[];
  cashbook: FinanceCashbookExportRow[];
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "event-system";

  const summary = wb.addWorksheet("summary");
  summary.columns = [{ width: 24 }, { width: 24 }];
  const receiptTotal = input.receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const taxTotal = input.receipts.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  const cashTotal = input.receipts
    .filter((r) => r.payment_method === "cash")
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  summary.addRow(["month", input.monthLabel]);
  summary.addRow(["expense_total", receiptTotal]);
  summary.addRow(["tax_total", taxTotal]);
  summary.addRow(["cash_total", cashTotal]);

  const cashbookSheet = wb.addWorksheet("cashbook");
  cashbookSheet.columns = [
    { header: "date", key: "entry_date", width: 14 },
    { header: "type", key: "entry_type", width: 10 },
    { header: "account", key: "account", width: 12 },
    { header: "category", key: "category", width: 14 },
    { header: "description", key: "description", width: 48 },
    { header: "amount", key: "amount", width: 14 },
  ];
  input.cashbook.forEach((r) =>
    cashbookSheet.addRow({
      entry_date: r.entry_date,
      entry_type: r.entry_type,
      account: r.account,
      category: r.category ?? "",
      description: r.description ?? "",
      amount: Math.round(Number(r.amount ?? 0)),
    })
  );

  const receiptSheet = wb.addWorksheet("receipts");
  receiptSheet.columns = [
    { header: "date", key: "expense_date", width: 14 },
    { header: "vendor", key: "vendor", width: 30 },
    { header: "category", key: "category", width: 14 },
    { header: "payment", key: "payment_method", width: 12 },
    { header: "amount", key: "amount", width: 14 },
    { header: "tax", key: "tax_amount", width: 14 },
    { header: "project", key: "project_title", width: 24 },
    { header: "agency", key: "agency_name", width: 24 },
    { header: "memo", key: "memo", width: 50 },
  ];
  input.receipts.forEach((r) =>
    receiptSheet.addRow({
      expense_date: r.expense_date,
      vendor: r.vendor ?? "",
      category: r.category ?? "",
      payment_method: r.payment_method ?? "",
      amount: Math.round(Number(r.amount ?? 0)),
      tax_amount: Math.round(Number(r.tax_amount ?? 0)),
      project_title: r.project_title ?? "",
      agency_name: r.agency_name ?? "",
      memo: r.memo ?? "",
    })
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function financeToPdfBuffer(input: {
  monthLabel: string;
  receipts: FinanceReceiptExportRow[];
  cashbook: FinanceCashbookExportRow[];
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([842, 595]); // landscape A4-ish

  let y = 560;
  const left = 24;
  page.drawText(`Finance Report ${input.monthLabel}`, {
    x: left,
    y,
    size: 16,
    font,
  });
  y -= 24;
  const receiptTotal = input.receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const taxTotal = input.receipts.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  page.drawText(`Expense: ${yen(receiptTotal)} JPY / Tax: ${yen(taxTotal)} JPY`, {
    x: left,
    y,
    size: 11,
    font,
  });
  y -= 26;

  page.drawText("Receipts", { x: left, y, size: 12, font });
  y -= 18;
  const receiptHead = "date        vendor                      amount    tax   category/payment";
  page.drawText(receiptHead, { x: left, y, size: 9, font });
  y -= 14;
  for (const r of input.receipts.slice(0, 16)) {
    const line =
      `${r.expense_date}  ${(r.vendor ?? "-").slice(0, 26).padEnd(26, " ")}` +
      `${yen(r.amount).padStart(8, " ")} ${yen(r.tax_amount).padStart(6, " ")} ` +
      `${(r.category ?? "other")}/${r.payment_method ?? "other"}`;
    page.drawText(line, { x: left, y, size: 8.5, font });
    y -= 12;
  }

  y -= 10;
  page.drawText("Cashbook", { x: left, y, size: 12, font });
  y -= 18;
  const cashHead = "date        type       amount    account/category";
  page.drawText(cashHead, { x: left, y, size: 9, font });
  y -= 14;
  for (const c of input.cashbook.slice(0, 18)) {
    const line =
      `${c.entry_date}  ${c.entry_type.padEnd(10, " ")}` +
      `${yen(c.amount).padStart(8, " ")} ` +
      `${c.account}/${c.category ?? "other"}`;
    page.drawText(line, { x: left, y, size: 8.5, font });
    y -= 12;
  }

  return Buffer.from(await pdf.save());
}
