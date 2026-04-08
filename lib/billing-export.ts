import ExcelJS from "exceljs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NOTO_JP_OTF =
  "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf";

export type BillingExportDoc = {
  id: string;
  kind: "invoice" | "estimate";
  doc_no: string;
  issue_date: string | null;
  due_date: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  note: string | null;
  agency_name: string | null;
  project_title: string | null;
};

export type BillingExportLine = {
  sort_order: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export async function billingToXlsxBuffer(doc: BillingExportDoc, lines: BillingExportLine[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(doc.kind === "invoice" ? "請求書" : "見積書");
  ws.columns = [
    { width: 8 },
    { width: 40 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
  ];
  ws.addRow([doc.kind === "invoice" ? "請求書" : "見積書", doc.doc_no]);
  ws.addRow(["発行日", doc.issue_date ?? "—"]);
  ws.addRow(["支払期限", doc.due_date ?? "—"]);
  ws.addRow(["宛名", doc.recipient_name ?? "—"]);
  ws.addRow(["メール", doc.recipient_email ?? "—"]);
  ws.addRow(["代理店", doc.agency_name ?? "—"]);
  ws.addRow(["案件", doc.project_title ?? "—"]);
  ws.addRow([]);
  ws.addRow(["#", "明細", "数量", "単価", "金額"]);
  for (const [i, l] of lines.entries()) {
    ws.addRow([i + 1, l.description, l.quantity, l.unit_price, l.amount]);
  }
  ws.addRow([]);
  ws.addRow(["", "", "", "小計", doc.subtotal]);
  ws.addRow(["", "", "", `消費税(${doc.tax_rate}%)`, doc.tax_amount]);
  ws.addRow(["", "", "", "合計", doc.total_amount]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function billingToPdfBuffer(doc: BillingExportDoc, lines: BillingExportLine[]) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([595.28, 841.89]);
  const fallback = await pdf.embedFont(StandardFonts.Helvetica);
  let font = fallback;
  try {
    const res = await fetch(NOTO_JP_OTF, { cache: "force-cache" });
    if (res.ok) {
      font = await pdf.embedFont(await res.arrayBuffer(), { subset: true });
    }
  } catch {}

  const black = rgb(0, 0, 0);
  let y = 790;
  page.drawText(doc.kind === "invoice" ? "請求書" : "見積書", { x: 40, y, size: 18, font, color: black });
  y -= 26;
  page.drawText(`No: ${doc.doc_no}`, { x: 40, y, size: 10, font, color: black });
  y -= 16;
  page.drawText(`発行日: ${doc.issue_date ?? "—"}  支払期限: ${doc.due_date ?? "—"}`, { x: 40, y, size: 10, font, color: black });
  y -= 16;
  page.drawText(`宛名: ${doc.recipient_name ?? "—"} (${doc.recipient_email ?? "—"})`, { x: 40, y, size: 10, font, color: black });
  y -= 22;
  page.drawText(`代理店: ${doc.agency_name ?? "—"} / 案件: ${doc.project_title ?? "—"}`, { x: 40, y, size: 10, font, color: black });
  y -= 26;
  page.drawText("明細", { x: 40, y, size: 12, font, color: black });
  y -= 16;
  for (const l of lines) {
    page.drawText(`${l.description}`, { x: 40, y, size: 10, font, color: black });
    page.drawText(`${l.quantity}`, { x: 330, y, size: 10, font, color: black });
    page.drawText(`${Math.round(l.unit_price).toLocaleString("ja-JP")}`, { x: 390, y, size: 10, font, color: black });
    page.drawText(`${Math.round(l.amount).toLocaleString("ja-JP")}`, { x: 490, y, size: 10, font, color: black });
    y -= 14;
    if (y < 80) break;
  }
  y -= 12;
  page.drawText(`小計: ${Math.round(doc.subtotal).toLocaleString("ja-JP")} 円`, { x: 360, y, size: 10, font, color: black });
  y -= 14;
  page.drawText(`消費税(${doc.tax_rate}%): ${Math.round(doc.tax_amount).toLocaleString("ja-JP")} 円`, { x: 360, y, size: 10, font, color: black });
  y -= 16;
  page.drawText(`合計: ${Math.round(doc.total_amount).toLocaleString("ja-JP")} 円`, { x: 360, y, size: 12, font, color: black });
  if (doc.note) {
    y -= 30;
    page.drawText(`備考: ${doc.note}`, { x: 40, y, size: 9, font, color: black });
  }
  return Buffer.from(await pdf.save());
}

