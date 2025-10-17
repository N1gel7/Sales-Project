import { dbConnect } from './_lib/db.js';
import Invoice from '../models/Invoice.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id, to } = req.body || {};
  if (!id || !to) return res.status(400).json({ error: 'id and to required' });

  await dbConnect(process.env.MONGODB_URI);
  const inv = await Invoice.findById(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const subject = `Invoice for ${inv.client}`;
    const text = `Client: ${inv.client}\nProduct: ${inv.product}\nPrice: ${inv.price}\nDate: ${inv.createdAt}`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


