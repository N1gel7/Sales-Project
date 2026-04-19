import { supabase } from './_lib/db.js';
import { withRole } from './_lib/authMiddleware.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendUserWelcomeEmail } from './_lib/mailer.js';

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
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
      const generatedPassword = crypto.randomBytes(8).toString('hex');
      const code = name.replace(/\s/g, '').substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(generatedPassword, salt);
      
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          name, 
          email, 
          code, 
          role, 
          password_hash: passwordHash, 
          active: true,
          has_changed_initial_password: false,
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
      
      const configuredAppUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const loginUrl = `${configuredAppUrl.replace(/\/$/, '')}/login`;
      try {
        await sendUserWelcomeEmail({
          to: email,
          name,
          generatedPassword,
          loginUrl,
        });
      } catch (mailError) {
        // User creation should still succeed even if email provider is unavailable.
        console.error('Failed to send welcome email:', mailError);
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

export default withRole('admin', 'manager')(handler);
