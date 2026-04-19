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

function toMs(raw, fallback) {
  const parsed = Number(raw || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
}

async function sendViaSmtp({ to, subject, html, text, attachments = [] }) {
  const cfgError = getMailerConfigError();
  if (cfgError) throw new Error(cfgError);

  // Gmail app passwords are often copied with spaces (e.g. "abcd efgh ...").
  // Normalize so SMTP auth receives the exact credential.
  const normalizedPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = toPort(process.env.SMTP_PORT);
  const timeoutMs = toMs(process.env.SMTP_TIMEOUT_MS, 15000);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: normalizedPass,
    },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs * 2,
  });

  const fromName = process.env.SMTP_FROM_NAME || 'Sales Team';
  // Use authenticated sender to avoid provider spoofing rejections.
  const fromEmail = process.env.SMTP_USER;
  const replyTo = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await withTimeout(transporter.verify(), timeoutMs, 'SMTP verify');
  await withTimeout(transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    replyTo,
    to,
    subject,
    html,
    text: text || stripHtml(html),
    attachments,
  }), timeoutMs * 2, 'SMTP send');
}

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  await sendViaSmtp({ to, subject, html, text, attachments });
  return { provider: 'smtp' };
}

export async function sendInvoiceEmail({ to, subject, html, pdfBuffer, filename }) {
  return sendEmail({
    to,
    subject,
    html,
    attachments: [{
      filename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}

export async function sendUserWelcomeEmail({ to, name, generatedPassword, loginUrl }) {
  const subject = 'Welcome to SalesOps - Your Account';
  const html = `<p>Hello ${name},</p>
    <p>An administrator has created an account for you on SalesOps.</p>
    <p>Your temporary password is: <strong>${generatedPassword}</strong></p>
    <p>Upon your first login, you will be prompted to change this password securely.</p>
    <br>
    <p>Login at: <a href="${loginUrl}">${loginUrl}</a></p>`;
  return sendEmail({ to, subject, html });
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const subject = 'Lumi - Password Reset';
  const html = `<p>You requested a password reset. Click the link below to reset it:</p>
    <br><a href="${resetLink}">Reset Password</a>
    <br><p>This link expires in 1 hour.</p>`;
  return sendEmail({ to, subject, html });
}
