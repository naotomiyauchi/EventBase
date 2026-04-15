type ReceiptOcrResult = {
  rawText: string;
  inferredVendor: string | null;
  inferredCategory: string | null;
  inferredAmount: number | null;
  inferredTaxAmount: number | null;
  inferredExpenseDate: string | null; // YYYY-MM-DD
  inferredPaymentMethod: "cash" | "bank" | "card" | "other";
  ocrEngine: "openai_vision" | "none";
  debug: {
    openAiAttempted: boolean;
    openAiError: string | null;
    apiKeyConfigured: boolean;
    documentAttempted: boolean;
    textAttempted: boolean;
    documentError: string | null;
    textError: string | null;
    rawTextLength: number;
  };
};

function normalizeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[，]/g, ",")
    .replace(/[￥]/g, "¥");
}

function splitMeaningfulLines(text: string): string[] {
  return normalizeText(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^[*\s]+|[*\s]+$/g, ""))
    .filter(Boolean)
    .filter((s) => !/^[-=_.]{2,}$/.test(s))
    .filter((s) => s.length <= 80);
}

function inferCategoryFromText(text: string): string | null {
  const t = normalizeText(text).toLowerCase();
  if (/caffe|cafe|スタバ|喫茶|コーヒー/.test(t)) return "meal";
  if (/高速|駐車|タクシー|交通|jr|suica|pasmo/.test(t)) return "transport";
  if (/コンビニ|スーパー|飲料|弁当|食事|レストラン|カフェ/.test(t)) return "meal";
  if (/備品|文具|消耗品|家電|ケーブル|電池/.test(t)) return "supplies";
  if (/宿泊|ホテル|旅館/.test(t)) return "lodging";
  if (/通信|携帯|電話|回線/.test(t)) return "communication";
  return null;
}

function inferVendorFromText(text: string): string | null {
  const lines = splitMeaningfulLines(text);
  const reject =
    /(領収|レシート|合計|総計|内税|外税|税|お預り|お釣|釣銭|現金|card|visa|master|電話|tel|登録番号|店No|レシートNo|担当|お客様|明細|軽減)/i;

  const candidates = lines.filter((s) => !reject.test(s));
  const brandLike = candidates.find((s) =>
    /^[A-Z][A-Z0-9&'().\-\s]{2,40}$/.test(s)
  );
  if (brandLike) return brandLike;

  const companyLike = candidates.find((s) =>
    /(店|商店|株式会社|有限会社|カフェ|レストラン|薬局|ドラッグ|モール)/.test(s)
  );
  if (companyLike) return companyLike;

  return candidates.find((s) => s.length >= 2 && s.length <= 40) ?? null;
}

function parseYenAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,，]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function inferAmountFromText(text: string): number | null {
  const normalized = normalizeText(text);
  const lines = splitMeaningfulLines(normalized);
  const priorityPatterns = [
    /(?:合計|総計|ご利用額|請求額)\s*[¥￥]?\s*([0-9,，]{1,9})/i,
    /[¥￥]\s*([0-9,，]{1,9})\s*$/m,
  ];
  for (const p of priorityPatterns) {
    const m = normalized.match(p);
    if (m?.[1]) {
      const parsed = parseYenAmount(m[1]);
      if (parsed != null) return parsed;
    }
  }

  for (const line of lines) {
    if (/(合計|総計|お会計|お買上|ご利用額|現計|請求額)/.test(line)) {
      const yenMatches = Array.from(line.matchAll(/[¥]\s*([0-9,]{2,9})/g))
        .map((m) => parseYenAmount(m[1]))
        .filter((v): v is number => v != null && v > 0);
      if (yenMatches.length > 0) return Math.max(...yenMatches);

      const m = line.match(/([0-9,]{2,9})\s*円/);
      if (m?.[1]) {
        const parsed = parseYenAmount(m[1]);
        if (parsed != null && parsed > 0) return parsed;
      }
    }
  }

  const candidates = Array.from(normalized.matchAll(/[¥]\s*([0-9,]{2,9})/g))
    .map((m) => parseYenAmount(m[1]))
    .filter((v): v is number => v != null && v > 0 && v < 10000000);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function inferTaxAmountFromText(text: string): number | null {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:消費税|税額|内税|外税)\s*(?:等)?\s*[¥￥]?\s*([0-9,，]{1,9})/i,
    /\(\s*内税\s*([0-9,，]{1,9})\s*\)/i,
  ];
  for (const p of patterns) {
    const m = normalized.match(p);
    if (m?.[1]) {
      const parsed = parseYenAmount(m[1]);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function inferDateFromText(text: string): string | null {
  const normalized = normalizeText(text);
  const matches = [
    ...Array.from(normalized.matchAll(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/g)),
    ...Array.from(normalized.matchAll(/(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/g)),
  ];

  for (const m of matches) {
    let y = m[1];
    if (y.length === 2) y = `20${y}`;
    const yearNum = Number(y);
    if (!Number.isFinite(yearNum) || yearNum < 2020 || yearNum > 2099) continue;
    const mmNum = Number(m[2]);
    const ddNum = Number(m[3]);
    if (mmNum < 1 || mmNum > 12 || ddNum < 1 || ddNum > 31) continue;
    const mm = String(mmNum).padStart(2, "0");
    const dd = String(ddNum).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function inferPaymentMethodFromText(text: string): "cash" | "bank" | "card" | "other" {
  const t = text.toLowerCase();
  if (/現金/.test(t)) return "cash";
  if (/card|クレジット|visa|master|jcb|amex/.test(t)) return "card";
  if (/振込|銀行|bank/.test(t)) return "bank";
  return "other";
}

function normalizeCategory(
  value: string | null | undefined
): "transport" | "meal" | "supplies" | "lodging" | "communication" | "other" | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (["transport", "meal", "supplies", "lodging", "communication", "other"].includes(v)) {
    return v as "transport" | "meal" | "supplies" | "lodging" | "communication" | "other";
  }
  if (/交通|タクシー|駐車/.test(v)) return "transport";
  if (/食|カフェ|飲食/.test(v)) return "meal";
  if (/備品|文具|消耗/.test(v)) return "supplies";
  if (/宿泊|ホテル/.test(v)) return "lodging";
  if (/通信|電話/.test(v)) return "communication";
  return "other";
}

function normalizePaymentMethod(
  value: string | null | undefined
): "cash" | "bank" | "card" | "other" {
  if (!value) return "other";
  const v = value.trim().toLowerCase();
  if (["cash", "bank", "card", "other"].includes(v)) {
    return v as "cash" | "bank" | "card" | "other";
  }
  if (/現金/.test(v)) return "cash";
  if (/振込|銀行/.test(v)) return "bank";
  if (/card|カード|visa|master|jcb|amex/.test(v)) return "card";
  return "other";
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = normalizeText(value);
  const m = t.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (y < 2020 || y > 2099 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${String(y)}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

type OpenAiReceipt = {
  vendor?: string | null;
  amount?: number | string | null;
  tax_amount?: number | string | null;
  expense_date?: string | null;
  category?: string | null;
  payment_method?: string | null;
  raw_text?: string | null;
};

async function analyzeWithOpenAiVision(
  imageBase64: string
): Promise<{ data: OpenAiReceipt | null; error: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { data: null, error: "OPENAI_API_KEY is missing" };
  const model = process.env.OPENAI_RECEIPT_MODEL || "gpt-4o-mini";

  const body = {
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a receipt parser. Return only JSON with keys: vendor, amount, tax_amount, expense_date, category, payment_method, raw_text. expense_date must be YYYY-MM-DD if possible. category in [transport, meal, supplies, lodging, communication, other]. payment_method in [cash, bank, card, other]. If unknown, use null.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read this Japanese receipt image and extract structured fields. Prefer actual total amount, not quantity count.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    if (!res.ok) return { data: null, error: `openai_${res.status}:${txt.slice(0, 300)}` };
    const json = JSON.parse(txt) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? null;
    if (!content) return { data: null, error: "openai_empty_content" };
    const parsed = JSON.parse(content) as OpenAiReceipt;
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "openai_request_failed" };
  }
}

export async function analyzeReceiptImage(image: Buffer): Promise<ReceiptOcrResult> {
  const b64 = image.toString("base64");
  const ai = await analyzeWithOpenAiVision(b64);
  if (ai.data) {
    const rawText = ai.data.raw_text?.trim() ?? "";
    const amount =
      typeof ai.data.amount === "number"
        ? ai.data.amount
        : parseYenAmount(String(ai.data.amount ?? ""));
    const taxAmount =
      typeof ai.data.tax_amount === "number"
        ? ai.data.tax_amount
        : parseYenAmount(String(ai.data.tax_amount ?? ""));
    const inferredByTextPayment = inferPaymentMethodFromText(rawText);
    const inferredByAiPayment = normalizePaymentMethod(ai.data.payment_method);
    const inferredPaymentMethod =
      ai.data.payment_method == null || inferredByAiPayment === "other"
        ? inferredByTextPayment
        : inferredByAiPayment;

    const inferredByAiCategory = normalizeCategory(ai.data.category);
    const inferredByTextCategory = inferCategoryFromText(rawText);
    const inferredCategory =
      ai.data.category == null || inferredByAiCategory === "other"
        ? inferredByTextCategory ?? "other"
        : inferredByAiCategory ?? inferredByTextCategory ?? "other";

    return {
      rawText,
      inferredVendor: ai.data.vendor?.trim() || inferVendorFromText(rawText) || null,
      inferredCategory,
      inferredAmount: amount && amount > 0 ? amount : inferAmountFromText(rawText),
      inferredTaxAmount: taxAmount && taxAmount >= 0 ? taxAmount : inferTaxAmountFromText(rawText),
      inferredExpenseDate: normalizeDate(ai.data.expense_date) ?? inferDateFromText(rawText),
      inferredPaymentMethod,
      ocrEngine: "openai_vision",
      debug: {
        openAiAttempted: true,
        openAiError: null,
        apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
        documentAttempted: false,
        textAttempted: false,
        documentError: null,
        textError: null,
        rawTextLength: rawText.length,
      },
    };
  }
  return {
    rawText: "",
    inferredVendor: null,
    inferredCategory: null,
    inferredAmount: null,
    inferredTaxAmount: null,
    inferredExpenseDate: null,
    inferredPaymentMethod: "other",
    ocrEngine: "none",
    debug: {
      openAiAttempted: true,
      openAiError: ai.error,
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      documentAttempted: false,
      textAttempted: false,
      documentError: "disabled_by_config",
      textError: "disabled_by_config",
      rawTextLength: 0,
    },
  };
}
