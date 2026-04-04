import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List products (with optional search/category filter) ──
    if (method === 'GET') {
      const { q, category } = req.query || {};
      
      let query = supabase.from('products').select('*').order('created_at', { ascending: false });

      if (q) query = query.ilike('name', `%${q}%`);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map(p => ({
        _id: p.id, name: p.name, price: p.price, category: p.category, details: p.details, attributes: p.attributes,
        createdAt: p.created_at, updatedAt: p.updated_at
      }));

      return res.status(200).json(formatted);
    }

    // ── POST: Create product ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, price, category, details, attributes } = body || {};

      if (!name) return res.status(400).json({ error: 'Product name is required' });

      const { data: p, error } = await supabase.from('products').insert([{
        name, price: price || 0, category: category || null, details: details || null, attributes: attributes || {}
      }]).select('*').single();

      if (error) throw error;

      const formatted = {
        _id: p.id, name: p.name, price: p.price, category: p.category, details: p.details, attributes: p.attributes, createdAt: p.created_at
      };
      return res.status(201).json(formatted);
    }

    // ── PATCH/PUT: Update product ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, name, price, category, details, attributes } = body || {};
      const prodId = _id || id || req.query?.id;

      if (!prodId) return res.status(400).json({ error: 'Product ID is required' });

      const updates = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (price !== undefined) updates.price = price;
      if (category !== undefined) updates.category = category;
      if (details !== undefined) updates.details = details;
      if (attributes !== undefined) updates.attributes = attributes;

      const { data: p, error } = await supabase.from('products').update(updates).eq('id', prodId).select('*').single();

      if (error) return res.status(404).json({ error: 'Product not found' });

      const formatted = {
        _id: p.id, name: p.name, price: p.price, category: p.category, details: p.details, attributes: p.attributes, updatedAt: p.updated_at
      };
      return res.status(200).json(formatted);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const prodId = body?._id || body?.id || req.query?.id;
      if (!prodId) return res.status(400).json({ error: 'Product ID is required' });

      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) throw error;
      return res.status(200).json({ message: 'Product deleted' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Products error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
