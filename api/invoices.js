import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';
import { generateInvoicePdfBuffer } from './_lib/invoicePdf.js';
import { sendInvoiceEmail } from './_lib/mailer.js';

function getInvoiceRouteParts(req) {
  const cleanUrl = (req.url || '').split('?')[0];
  const parts = cleanUrl.split('/').filter(Boolean);
  const invoicesIndex = parts.findIndex((part) => part === 'invoices');
  if (invoicesIndex < 0) return { invoiceId: null, action: null };
  return {
    invoiceId: parts[invoicesIndex + 1] || null,
    action: parts[invoicesIndex + 2] || null,
  };
}

function normalizeInvoice(record) {
  return {
    _id: record.id,
    client: record.client,
    product: record.product,
    price: Number(record.price) || 0,
    status: record.status,
    location: typeof record.location === 'string' ? JSON.parse(record.location) : record.location,
    emailed: !!record.emailed,
    emailSent: !!record.emailed,
    emailTo: record.email_to || null,
    emailSentAt: record.email_sent_at || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function getInvoiceById(id) {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function handler(req, res) {
  const { method } = req;
  const { invoiceId, action } = getInvoiceRouteParts(req);

  try {
    // ── GET /api/invoices/:id/pdf ──
    if (method === 'GET' && invoiceId && action === 'pdf') {
      const invoice = await getInvoiceById(invoiceId);
      const pdfBuffer = await generateInvoicePdfBuffer(invoice);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.id}.pdf`);
      return res.status(200).send(pdfBuffer);
    }

    // ── GET: List invoices ──
    if (method === 'GET' && !invoiceId) {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const formatted = data.map((invoice) => normalizeInvoice(invoice));
      return res.status(200).json(formatted);
    }

    // ── POST /api/invoices/:id/email ──
    if (method === 'POST' && invoiceId && action === 'email') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const to = (body.to || '').trim();

      if (!to) {
        return res.status(400).json({ success: false, message: 'Recipient email is required.' });
      }

      const invoice = await getInvoiceById(invoiceId);
      const pdfBuffer = await generateInvoicePdfBuffer(invoice);
      const subject = body.subject || `Invoice #${invoice.id.slice(-8)} - ${invoice.product}`;
      const message = body.message || 'Thank you for your business. Please find your invoice attached.';

      await sendInvoiceEmail({
        to,
        subject,
        html: `<p>${message}</p>`,
        pdfBuffer,
        filename: `invoice-${invoice.id}.pdf`,
      });

      const { data: updated, error: updateError } = await supabase
        .from('invoices')
        .update({
          emailed: true,
          email_to: to,
          email_subject: subject,
          email_message: message,
          email_sent_at: new Date().toISOString(),
          status: invoice.status === 'draft' ? 'sent' : invoice.status,
        })
        .eq('id', invoice.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await logActivity({
        type: 'invoice_emailed',
        action: `Invoice for "${invoice.client}" sent to ${to}`,
        actorId: req.user?.id,
        refId: invoice.id,
        refType: 'invoice',
        meta: { to, subject },
      });

      return res.status(200).json({
        success: true,
        recipient: to,
        invoice: normalizeInvoice(updated),
      });
    }

    // ── POST: Create invoice ──
    if (method === 'POST' && !invoiceId) {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { client, product, price, status, location, coords } = body || {};

      if (!client || !product) {
        return res.status(400).json({ error: 'Client and product are required' });
      }

      const invoiceLocation = location || coords || null;

      const { data: i, error } = await supabase.from('invoices').insert([{
        client, product, price: price || 0, status: status || 'draft',
        location: invoiceLocation, created_by: req.user?.id || null
      }]).select('*').single();
      if (error) throw error;

      await logActivity({
        type: 'invoice_created', action: `Invoice for "${client}" created`,
        actorId: req.user?.id, refId: i.id, refType: 'invoice',
        meta: { client, product, price }
      });

      const formatted = normalizeInvoice(i);
      return res.status(201).json(formatted);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
