import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import {
  displayExportAge,
  type StaffExportHistoryRow,
  type StaffExportRecord,
} from "@/lib/staff-export";

const NOTO_JP_OTF =
  "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** #FF8C00 */
const ORANGE = rgb(1, 140 / 255, 0);
/** #FFFF99 */
const LABEL_BG = rgb(1, 1, 153 / 255);
/** #333333 */
const SECTION_BG = rgb(51 / 255, 51 / 255, 51 / 255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const TEXT = rgb(0, 0, 0);

const BORDER = 0.45;
const LABEL_FS = 8.5;
const VALUE_FS = 9;
const NAME_FS = 15;
const HEADER_H = 34;
const SECTION_BAR_H = 22;
const ROW_H = 22;
const NAME_ROW_H = 34;
const TABLE_HEADER_H = 20;
const TABLE_ROW_H = 24;
const PR_LINE_H = 11;

const COL_FRACS = [0.12, 0.1, 0.18, 0.14, 0.46];

type PdfCtx = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  yTop: number;
  font: PDFFont;
};

/** 足りない場合は新規ページへ。戻り値: 改ページしたか */
function ensureSpace(ctx: PdfCtx, need: number): boolean {
  if (ctx.yTop - need < MARGIN + 24) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H]);
    ctx.yTop = PAGE_H - MARGIN;
    return true;
  }
  return false;
}

function formatBirthSlash(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso).trim().slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${parseInt(y, 10)}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function genderShort(v: string | null | undefined): string {
  switch (v) {
    case "male":
      return "男";
    case "female":
      return "女";
    case "other":
      return "その他";
    case "unspecified":
      return "—";
    default:
      return "—";
  }
}

function yesNoShort(v: string | null | undefined): string {
  if (v === "yes") return "可";
  if (v === "no") return "不可";
  return "—";
}

function hasCarShort(v: boolean | null | undefined): string {
  if (v === true) return "有り";
  if (v === false) return "無し";
  return "—";
}

function dash(s: string | null | undefined): string {
  const t = s?.trim();
  return t && t.length > 0 ? t : "—";
}

function wrapChars(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    const test = line + ch;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line.length) lines.push(line);
      line = ch;
    }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [""];
}

function drawCell(
  page: PDFPage,
  x: number,
  yBottom: number,
  w: number,
  h: number,
  fill: ReturnType<typeof rgb>
) {
  page.drawRectangle({
    x,
    y: yBottom,
    width: w,
    height: h,
    color: fill,
    borderColor: BLACK,
    borderWidth: BORDER,
  });
}

function centerTextInCell(
  page: PDFPage,
  text: string,
  x: number,
  yBottom: number,
  w: number,
  h: number,
  size: number,
  font: PDFFont
) {
  const tw = font.widthOfTextAtSize(text, size);
  const tx = x + Math.max(0, (w - tw) / 2);
  const baseline = yBottom + (h - size) / 2 + size * 0.12;
  page.drawText(text, {
    x: tx,
    y: baseline,
    size,
    font,
    color: TEXT,
  });
}

function drawProfileHeader(page: PDFPage, font: PDFFont, yTop: number): number {
  const yBottom = yTop - HEADER_H;
  page.drawRectangle({
    x: MARGIN,
    y: yBottom,
    width: CONTENT_W,
    height: HEADER_H,
    color: ORANGE,
    borderColor: BLACK,
    borderWidth: BORDER,
  });
  const title = "Profile Sheet";
  const fs = 14;
  const tw = font.widthOfTextAtSize(title, fs);
  page.drawText(title, {
    x: MARGIN + (CONTENT_W - tw) / 2,
    y: yBottom + (HEADER_H - fs) / 2 + fs * 0.25,
    size: fs,
    font,
    color: WHITE,
  });
  return yTop - HEADER_H;
}

function measureAddressRowHeight(
  value: string,
  font: PDFFont,
  valueW: number,
  valueFs: number
): number {
  const lines = wrapChars(value || "—", valueW - 12, font, valueFs);
  const lineHeight = valueFs * 1.12;
  const inner = lines.length * lineHeight + 10;
  return Math.max(ROW_H, Math.min(inner, 72));
}

function drawFullRow(
  page: PDFPage,
  font: PDFFont,
  yTop: number,
  label: string,
  value: string,
  opts?: { nameLarge?: boolean; address?: boolean }
): number {
  const labelW = CONTENT_W * 0.22;
  const valueW = CONTENT_W - labelW;
  const rowH = opts?.nameLarge
    ? NAME_ROW_H
    : opts?.address
      ? measureAddressRowHeight(value, font, valueW, VALUE_FS)
      : ROW_H;
  const valueFs = opts?.nameLarge ? NAME_FS : VALUE_FS;
  const yBottom = yTop - rowH;

  drawCell(page, MARGIN, yBottom, labelW, rowH, LABEL_BG);
  drawCell(page, MARGIN + labelW, yBottom, valueW, rowH, WHITE);

  centerTextInCell(page, label, MARGIN, yBottom, labelW, rowH, LABEL_FS, font);

  if (opts?.nameLarge) {
    const baseline = yBottom + (rowH - valueFs) / 2 + valueFs * 0.15;
    page.drawText(value || "—", {
      x: MARGIN + labelW + 6,
      y: baseline,
      size: valueFs,
      font,
      color: TEXT,
    });
  } else {
    const lines = wrapChars(value || "—", valueW - 12, font, valueFs);
    const lineHeight = valueFs * 1.12;
    let ly = yBottom + rowH - 8 - (lines.length - 1) * lineHeight;
    for (const ln of lines) {
      page.drawText(ln, {
        x: MARGIN + labelW + 6,
        y: ly,
        size: valueFs,
        font,
        color: TEXT,
      });
      ly -= lineHeight;
    }
  }

  return yTop - rowH;
}

function drawSixCellRow(
  page: PDFPage,
  font: PDFFont,
  yTop: number,
  triples: [string, string, string, string, string, string]
): number {
  const w = CONTENT_W / 6;
  const rowH = ROW_H;
  const yBottom = yTop - rowH;
  for (let i = 0; i < 6; i++) {
    const x = MARGIN + i * w;
    const isLabel = i % 2 === 0;
    drawCell(page, x, yBottom, w, rowH, isLabel ? LABEL_BG : WHITE);
    const text = triples[i];
    if (isLabel) {
      centerTextInCell(page, text, x, yBottom, w, rowH, LABEL_FS, font);
    } else {
      centerTextInCell(page, text, x, yBottom, w, rowH, VALUE_FS, font);
    }
  }
  return yTop - rowH;
}

/** 勤務開始希望: ラベル1セル + 値1セル + 右4セル（空欄） */
function drawStartPreferenceRow(
  page: PDFPage,
  font: PDFFont,
  yTop: number,
  label: string,
  value: string
): number {
  const w = CONTENT_W / 6;
  const rowH = ROW_H;
  const yBottom = yTop - rowH;
  drawCell(page, MARGIN, yBottom, w, rowH, LABEL_BG);
  drawCell(page, MARGIN + w, yBottom, w, rowH, WHITE);
  drawCell(page, MARGIN + w * 2, yBottom, w * 4, rowH, WHITE);
  centerTextInCell(page, label, MARGIN, yBottom, w, rowH, LABEL_FS, font);
  centerTextInCell(page, value, MARGIN + w, yBottom, w, rowH, VALUE_FS, font);
  return yTop - rowH;
}

function drawSectionBar(
  page: PDFPage,
  font: PDFFont,
  yTop: number,
  title: string
): number {
  const yBottom = yTop - SECTION_BAR_H;
  page.drawRectangle({
    x: MARGIN,
    y: yBottom,
    width: CONTENT_W,
    height: SECTION_BAR_H,
    color: SECTION_BG,
    borderColor: BLACK,
    borderWidth: BORDER,
  });
  const fs = 10;
  const tw = font.widthOfTextAtSize(title, fs);
  page.drawText(title, {
    x: MARGIN + (CONTENT_W - tw) / 2,
    y: yBottom + (SECTION_BAR_H - fs) / 2 + fs * 0.25,
    size: fs,
    font,
    color: WHITE,
  });
  return yTop - SECTION_BAR_H;
}

function drawWorkHistoryHeader(ctx: PdfCtx, colWs: number[]) {
  const { page, font } = ctx;
  const headers = ["年", "月", "勤務期間", "職種", "職務内容"];
  const headerBottom = ctx.yTop - TABLE_HEADER_H;
  let hx = MARGIN;
  for (let c = 0; c < 5; c++) {
    drawCell(page, hx, headerBottom, colWs[c], TABLE_HEADER_H, LABEL_BG);
    centerTextInCell(
      page,
      headers[c],
      hx,
      headerBottom,
      colWs[c],
      TABLE_HEADER_H,
      LABEL_FS,
      font
    );
    hx += colWs[c];
  }
  ctx.yTop -= TABLE_HEADER_H;
}

function drawWorkHistoryDataRow(
  ctx: PdfCtx,
  colWs: number[],
  h: StaffExportHistoryRow | null
) {
  const { page, font } = ctx;
  const rowBottom = ctx.yTop - TABLE_ROW_H;
  const yearT = h?.year != null ? String(h.year) : "";
  const monthT = h?.month != null ? String(h.month) : "";
  const periodT = h?.period_label?.trim() ? h.period_label.trim() : "";
  const jobT = h?.job_content?.trim() ? h.job_content.trim() : "";

  let cx = MARGIN;
  const smallCells = [yearT, monthT, periodT, "—"];
  for (let c = 0; c < 4; c++) {
    drawCell(page, cx, rowBottom, colWs[c], TABLE_ROW_H, WHITE);
    const t = smallCells[c];
    if (t.length > 0) {
      centerTextInCell(
        page,
        t,
        cx,
        rowBottom,
        colWs[c],
        TABLE_ROW_H,
        VALUE_FS,
        font
      );
    }
    cx += colWs[c];
  }
  drawCell(page, cx, rowBottom, colWs[4], TABLE_ROW_H, WHITE);
  if (jobT) {
    const wrapped = wrapChars(jobT, colWs[4] - 8, font, 7.5);
    const lineH = 7.5 * 1.08;
    const use = wrapped.slice(0, 3);
    let ly = rowBottom + TABLE_ROW_H - 6 - (use.length - 1) * lineH;
    for (const ln of use) {
      page.drawText(ln, {
        x: cx + 3,
        y: ly,
        size: 7.5,
        font,
        color: TEXT,
      });
      ly -= lineH;
    }
  }
  ctx.yTop -= TABLE_ROW_H;
}

function drawWorkHistoryTable(ctx: PdfCtx, history: StaffExportHistoryRow[]) {
  const colWs = COL_FRACS.map((f) => CONTENT_W * f);
  const minBodyRows = Math.max(4, history.length);
  const rows: (StaffExportHistoryRow | null)[] = [...history];
  while (rows.length < minBodyRows) rows.push(null);

  ensureSpace(ctx, TABLE_HEADER_H + TABLE_ROW_H + 16);
  drawWorkHistoryHeader(ctx, colWs);

  for (const h of rows) {
    const broke = ensureSpace(ctx, TABLE_ROW_H + 12);
    if (broke) {
      drawWorkHistoryHeader(ctx, colWs);
    }
    drawWorkHistoryDataRow(ctx, colWs, h);
  }
}

function measurePrBoxHeight(pr: string, font: PDFFont): number {
  const text = pr.trim() || "—";
  const maxW = CONTENT_W - 16;
  const lines = wrapChars(text, maxW, font, PR_LINE_H);
  const minLines = 8;
  const n = Math.max(minLines, lines.length);
  return Math.max(120, n * (PR_LINE_H * 1.15) + 20);
}

function drawPrBlock(ctx: PdfCtx, pr: string) {
  const { page, font } = ctx;
  const text = pr.trim() || "—";
  const maxW = CONTENT_W - 16;
  const lines = wrapChars(text, maxW, font, PR_LINE_H);
  const minLines = 8;
  const padCount = Math.max(0, minLines - lines.length);
  const boxH = measurePrBoxHeight(pr, font);
  const yBottom = ctx.yTop - boxH;

  page.drawRectangle({
    x: MARGIN,
    y: yBottom,
    width: CONTENT_W,
    height: boxH,
    color: WHITE,
    borderColor: BLACK,
    borderWidth: BORDER,
  });

  let ly = yBottom + boxH - 14;
  for (const ln of lines) {
    if (ly < yBottom + 8) break;
    page.drawText(ln, {
      x: MARGIN + 8,
      y: ly,
      size: PR_LINE_H,
      font,
      color: TEXT,
    });
    ly -= PR_LINE_H * 1.15;
  }
  for (let i = 0; i < padCount; i++) {
    ly -= PR_LINE_H * 1.15;
  }

  ctx.yTop -= boxH;
}

export async function staffExportToPdfBytes(
  staff: StaffExportRecord,
  history: StaffExportHistoryRow[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let fontBytes: ArrayBuffer;
  try {
    const res = await fetch(NOTO_JP_OTF);
    if (!res.ok) throw new Error(`font ${res.status}`);
    fontBytes = await res.arrayBuffer();
  } catch {
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    page.drawText("Font fetch failed. Please use Excel export.", {
      x: MARGIN,
      y: PAGE_H - MARGIN,
      size: 12,
      font: helv,
    });
    return pdfDoc.save();
  }

  const font = await pdfDoc.embedFont(new Uint8Array(fontBytes));

  const addr =
    (staff.address ?? staff.base_address)?.trim() || "";

  const ctx: PdfCtx = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_W, PAGE_H]),
    yTop: PAGE_H - MARGIN,
    font,
  };

  ctx.yTop = drawProfileHeader(ctx.page, ctx.font, ctx.yTop);
  ctx.yTop = drawFullRow(ctx.page, ctx.font, ctx.yTop, "フリガナ", dash(staff.name_kana));
  ctx.yTop = drawFullRow(ctx.page, ctx.font, ctx.yTop, "名前", staff.name || "—", {
    nameLarge: true,
  });
  if (addr) {
    ctx.yTop = drawFullRow(ctx.page, ctx.font, ctx.yTop, "住所", addr, {
      address: true,
    });
  }

  ctx.yTop = drawSixCellRow(ctx.page, ctx.font, ctx.yTop, [
    "性別",
    genderShort(staff.gender),
    "生年月日",
    formatBirthSlash(staff.birth_date),
    "年齢",
    displayExportAge(staff),
  ]);

  ctx.yTop = drawSixCellRow(ctx.page, ctx.font, ctx.yTop, [
    "希望勤務地",
    dash(staff.preferred_work_location),
    "最寄駅",
    dash(staff.nearest_station),
    "車の有無",
    hasCarShort(staff.has_car),
  ]);

  ctx.yTop = drawSixCellRow(ctx.page, ctx.font, ctx.yTop, [
    "通勤希望時間",
    dash(staff.commute_time_preference),
    "出張",
    yesNoShort(staff.can_business_trip),
    "",
    "",
  ]);

  ctx.yTop = drawSixCellRow(ctx.page, ctx.font, ctx.yTop, [
    "土日祝",
    yesNoShort(staff.can_weekend_holiday),
    "勤務希望",
    "—",
    "",
    "",
  ]);

  ctx.yTop = drawStartPreferenceRow(
    ctx.page,
    ctx.font,
    ctx.yTop,
    "勤務開始希望",
    dash(staff.preferred_shift_start)
  );

  ensureSpace(ctx, SECTION_BAR_H + TABLE_HEADER_H + TABLE_ROW_H * 5 + 32);

  ctx.yTop = drawSectionBar(ctx.page, ctx.font, ctx.yTop, "職 務 経 歴");
  drawWorkHistoryTable(ctx, history);

  ensureSpace(ctx, SECTION_BAR_H + measurePrBoxHeight(staff.pr_notes ?? "", font) + 24);

  ctx.yTop = drawSectionBar(ctx.page, ctx.font, ctx.yTop, "その他 PRポイント");
  drawPrBlock(ctx, staff.pr_notes ?? "");

  return pdfDoc.save();
}
