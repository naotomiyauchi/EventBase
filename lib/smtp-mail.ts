import nodemailer from "nodemailer";

type MailAttachment = {
  filename: string;
  content: string;
  encoding?: "base64";
};

type SendMailInput = {
  from: string;
  to: string[];
  bcc?: string[];
  subject: string;
  text: string;
  attachments?: MailAttachment[];
};

function envBool(v: string | undefined, defaultValue: boolean): boolean {
  if (v == null) return defaultValue;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function smtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !portRaw || !user || !pass) {
    throw new Error("smtp_not_configured");
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("smtp_port_invalid");
  }
  const secure = envBool(process.env.SMTP_SECURE, port === 465);
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMailViaSmtp(input: SendMailInput): Promise<string> {
  const transport = smtpTransport();
  const info = await transport.sendMail({
    from: input.from,
    to: input.to,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments,
  });
  return info.messageId ?? "";
}
