import { supabase } from './_lib/db.js';
import { withAuth } from './_lib/authMiddleware.js';
import bcrypt from 'bcryptjs';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, code, role, active, avatar_url, created_at')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      const formattedData = data.map(u => ({
        _id: u.id,
        name: u.name,
        email: u.email,
        code: u.code,
        role: u.role,
        active: u.active,
        avatarUrl: u.avatar_url,
        createdAt: u.created_at
      }));

      return res.status(200).json(formattedData);
    } catch (error) {
      console.error('Users GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  } else if (req.method === 'POST') {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
      const code = name.replace(/\s/g, '').substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          name, 
          email, 
          code, 
          role, 
          password_hash: passwordHash, 
          active: true,
          reset_password_token: null,
          // Sentinel value: 0 means first login must change initial password.
          reset_password_expires: 0
        }])
        .select('id, created_at')
        .single();
        
      if (error) {
        if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
          return res.status(409).json({ error: 'Email already exists' });
        }
        throw error;
      }
      
      const newUser = { 
        _id: data.id, 
        name, 
        email, 
        role, 
        code, 
        active: true, 
        avatarUrl: null, 
        createdAt: data.created_at 
      };
      
      return res.status(201).json(newUser);
    } catch (error) {
      console.error('Users POST error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  return res.status(405).end();
}

export default withAuth(handler);
