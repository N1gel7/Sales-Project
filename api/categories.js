import supabase from './_lib/supabase.js';
import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method } = req;

  try {
    // ── GET: List all categories ──
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, fields, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) throw error;

      // Map 'id' to '_id' for frontend compatibility
      const formattedData = data.map(item => ({
        ...item,
        _id: item.id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      return res.status(200).json(formattedData);
    }

    // ── POST: Create a new category ──
    if (method === 'POST') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { name, fields } = body || {};

      if (!name) return res.status(400).json({ error: 'Category name is required' });

      const { data, error } = await supabase
        .from('categories')
        .insert([{ 
          name: name.trim(), 
          fields: fields ? fields : [] 
        }])
        .select('id, name, fields, created_at')
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation in PG
          return res.status(409).json({ error: 'A category with that name already exists' });
        }
        throw error;
      }

      return res.status(201).json({
        ...data,
        _id: data.id,
        createdAt: data.created_at
      });
    }

    // ── PATCH/PUT: Update a category ──
    if (method === 'PATCH' || method === 'PUT') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { _id, id, name, fields } = body || {};
      const catId = _id || id;

      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      // Build update object dynamically to mimic COALESCE behavior
      const updates = { updated_at: new Date().toISOString() };
      if (name) updates.name = name;
      if (fields) updates.fields = fields;

      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', catId)
        .select('id, name, fields, updated_at')
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found for .single()
          return res.status(404).json({ error: 'Category not found' });
        }
        throw error;
      }

      return res.status(200).json({
        ...data,
        _id: data.id,
        updatedAt: data.updated_at
      });
    }

    // ── DELETE ──
    if (method === 'DELETE') {
      let body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const catId = body?._id || body?.id || req.query?.id;
      if (!catId) return res.status(400).json({ error: 'Category ID is required' });

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;
      return res.status(200).json({ message: 'Category deleted' });
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Categories error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
