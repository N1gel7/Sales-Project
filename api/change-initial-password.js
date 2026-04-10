import supabase from './_lib/supabase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from './_lib/jwtConfig.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email: rawEmail, currentPassword, newPassword } = body || {};
    const email = rawEmail?.toLowerCase().trim();

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Email, current password, and new password are required' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include upper, lower, number, and symbol.'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.active) return res.status(403).json({ error: 'Account is inactive or disabled' });
    if (Number(user.reset_password_expires) !== 0) {
      return res.status(400).json({ error: 'Initial password change is not required for this account' });
    }

    const isValidCurrent = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidCurrent) return res.status(401).json({ error: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_password_token: null,
        reset_password_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    if (updateError) throw updateError;

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      code: user.code
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const { password_hash, ...safeUser } = user;
    return res.status(200).json({
      message: 'Password changed successfully',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Change initial password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
