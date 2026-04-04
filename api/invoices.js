import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import { logActivity } from './_lib/activityLogger.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List invoices ──
    if (method === 'GET') {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const formatted = data.map(i => ({
        _id: i.id, client: i.client, product: i.product, price: i.price, status: i.status, 
        location: typeof i.location === 'string' ? JSON.parse(i.location) : i.location, emailed: i.emailed,
        createdAt: i.created_at, updatedAt: i.updated_at
      }));
      return res.status(200).json(formatted);
    }

    // ── POST: Create invoice ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { client, product, price, status, location } = body || {};

      if (!client || !product) {
        return res.status(400).json({ error: 'Client and product are required' });
      }

      const { data: i, error } = await supabase.from('invoices').insert([{
        client, product, price: price || 0, status: status || 'draft', 
        location: location || null, created_by: req.user?.id || null
      }]).select('*').single();
      if (error) throw error;

      await logActivity({
        type: 'invoice_created', action: `Invoice for "${client}" created`,
        actorId: req.user?.id, refId: i.id, refType: 'invoice',
        meta: { client, product, price }
      });

      const formatted = {
        _id: i.id, client: i.client, product: i.product, price: i.price, status: i.status, 
        location: typeof i.location === 'string' ? JSON.parse(i.location) : i.location, emailed: i.emailed,
        createdAt: i.created_at
      };
      return res.status(201).json(formatted);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
