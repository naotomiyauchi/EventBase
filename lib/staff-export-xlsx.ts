import ExcelJS from "exceljs";
import {
  buildStaffExportPairs,
  type StaffExportHistoryRow,
  type StaffExportRecord,
} from "@/lib/staff-export";

/** PDF と同じ #FF8C00 / #FFFF99（lib/staff-export-pdf.ts と揃える） */
const ARGB_ORANGE = "FFFF8C00";
const ARGB_LABEL_BG = "FFFFFF99";
const ARGB_WHITE = "FFFFFFFF";

/** Excel ブック（.xlsx）。Google 連携や追加ログインは不要。 */
export async function staffExportToXlsxBuffer(
  staff: StaffExportRecord,
  history: StaffExportHistoryRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "event-system";

  const sheet = workbook.addWorksheet("プロフィール", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  sheet.columns = [{ width: 28 }, { width: 56 }];

  sheet.mergeCells("A1:B1");
  sheet.getRow(1).height = 34;
  const titleCell = sheet.getCell("A1");
  titleCell.value = "Profile Sheet";
  titleCell.font = { bold: true, color: { argb: ARGB_WHITE } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ARGB_ORANGE },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  const headerRow = sheet.addRow(["項目", "内容"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ARGB_LABEL_BG },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const pairs = buildStaffExportPairs(staff, history);
  for (const p of pairs) {
    const row = sheet.addRow([p.label, p.value]);
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ARGB_LABEL_BG },
    };
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ARGB_WHITE },
    };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
