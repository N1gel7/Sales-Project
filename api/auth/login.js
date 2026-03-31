import { getDbPool } from '../_lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';

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
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = getDbPool();
    const result = await pool.query('SELECT id, name, email, role, code, password_hash, active FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is inactive or disabled' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Prepare token payload mapping to the application's structure
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      code: user.code
    };

    // Issue JWT
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    return res.status(200).json({ 
      token, 
      user: payload 
    });

  } catch (error) {
    console.error('Fatal Login Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
