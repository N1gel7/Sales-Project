import supabase from './_lib/supabase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from './_lib/jwtConfig.js';

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
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is inactive or disabled' });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    // First login flow for admin-created users:
    // reset_password_expires === 0 is used as "must change initial password".
    if (Number(user.reset_password_expires) === 0) {
      return res.status(200).json({
        requiresPasswordChange: true,
        message: 'Password change required before first login',
        user: { id: user.id, email: user.email, name: user.name }
      });
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

    // SPA uses Authorization: Bearer + localStorage only. Do not set authToken cookie:
    // browsers kept stale cookies that overrode Bearer and caused jwt "invalid signature".

    // Response data
    const { password_hash, ...safeUser } = user;
    
    return res.status(200).json({ 
      message: "Login successful",
      user: safeUser,
      token: token,
      requiresPasswordChange: false
    });

  } catch (error) {
    console.error('Fatal Login Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
