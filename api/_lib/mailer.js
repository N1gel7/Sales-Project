import nodemailer from 'nodemailer';

function toPort(raw) {
  const parsed = Number(raw || 587);
  return Number.isNaN(parsed) ? 587 : parsed;
}

export function getMailerConfigError() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !process.env[key]);
  if (!missing.length) return null;
  return `Missing SMTP env vars: ${missing.join(', ')}`;
}

export async function sendInvoiceEmail({ to, subject, html, pdfBuffer, filename }) {
  const cfgError = getMailerConfigError();
  if (cfgError) {
    throw new Error(cfgError);
  }

  // Gmail app passwords are often copied with spaces (e.g. "abcd efgh ...").
  // Normalize so SMTP auth receives the exact credential.
  const normalizedPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = toPort(process.env.SMTP_PORT);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: normalizedPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  const fromName = process.env.SMTP_FROM_NAME || 'Sales Team';
  // Use authenticated sender to avoid provider spoofing rejections.
  const fromEmail = process.env.SMTP_USER;
  const replyTo = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.verify();

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    replyTo,
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
