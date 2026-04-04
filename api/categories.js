import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List all categories ──
    if (method === 'GET') {
      const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
      if (error) throw error;
      
      const formatted = data.map(c => ({
        _id: c.id, name: c.name, fields: typeof c.fields === 'string' ? JSON.parse(c.fields) : c.fields,
        createdAt: c.created_at, updatedAt: c.updated_at
      }));
      return res.status(200).json(formatted);
    }

    // ── POST: Create a new category ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, fields } = body || {};

      if (!name) return res.status(400).json({ error: 'Category name is required' });

      const { data: c, error } = await supabase.from('categories').insert([{
        name: name.trim(), fields: fields || []
      }]).select('*').single();

      if (error) {
        if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
          return res.status(409).json({ error: 'A category with that name already exists' });
        }
        throw error;
      }
      
      const formatted = { _id: c.id, name: c.name, fields: typeof c.fields === 'string' ? JSON.parse(c.fields) : c.fields, createdAt: c.created_at };
      return res.status(201).json(formatted);
    }

    // ── PATCH/PUT: Update a category ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, name, fields } = body || {};
      const catId = _id || id;

      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      const updates = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (fields !== undefined) updates.fields = fields;

      const { data: c, error } = await supabase.from('categories').update(updates).eq('id', catId).select('*').single();

      if (error) return res.status(404).json({ error: 'Category not found' });
      
      const formatted = { _id: c.id, name: c.name, fields: typeof c.fields === 'string' ? JSON.parse(c.fields) : c.fields, updatedAt: c.updated_at };
      return res.status(200).json(formatted);
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const catId = body?._id || body?.id || req.query?.id;
      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
      return res.status(200).json({ message: 'Category deleted' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Categories error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
