import supabase from './_lib/supabase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { email: rawEmail, password } = body || {};
    const email = rawEmail?.toLowerCase().trim();
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Fill in all required fields' });
    }

    // Retrieve from the database and check if user email is valid using Supabase sdk
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is inactive or disabled' });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create tokenPayload
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name, // keeping these generic attributes for frontend compatibility 
      role: user.role,
      code: user.code
    };

    // Create jwt token
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    // Set cookie for localhost development via Vercel headers
    // 60*60 is 3600 seconds = 1 hour (aligns with what user wrote)
    res.setHeader('Set-Cookie', `authToken=${token}; HttpOnly; Path=/; Max-Age=3600; SameSite=Lax`);

    // Response data
    const { password_hash, ...safeUser } = user;
    
    return res.status(200).json({ 
      message: "Login successful",
      user: safeUser,
      token: token 
    });

  } catch (error) {
    console.error('Fatal Login Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
