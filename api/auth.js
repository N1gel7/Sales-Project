import supabase from './_lib/supabase.js';
import { supabase as supabaseDb } from './_lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, JWT_EXPIRES_IN } from './_lib/jwtConfig.js';
import { withAuth } from './_lib/authMiddleware.js';
import { sendPasswordResetEmail } from './_lib/mailer.js';

function requiresInitialPasswordChange(user) {
  // Preferred explicit flag.
  if (typeof user?.has_changed_initial_password === 'boolean') {
    return user.has_changed_initial_password === false;
  }

  // Backward compatibility for older rows that used reset_password_expires = 0 as a sentinel.
  return user?.reset_password_expires === 0 || user?.reset_password_expires === '0';
}

/**
 * Handles user authentication via email and password.
 * Checks against the database and returns a JWT on success.
 * 
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { email: rawEmail, password } = body || {};
  const email = rawEmail?.toLowerCase().trim();

  if (!email || !password) return res.status(400).json({ error: 'Fill in all required fields' });

  const { data: user, error } = await supabase
    .from('users').select('*').eq('email', email).single();

  if (error || !user) return res.status(401).json({ error: 'Incorrect email or password' });
  if (!user.active) return res.status(403).json({ error: 'Account is inactive or disabled' });

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) return res.status(401).json({ error: 'Incorrect email or password' });

  if (requiresInitialPasswordChange(user)) {
    return res.status(200).json({
      requiresPasswordChange: true,
      message: 'Password change required before first login',
      user: { id: user.id, email: user.email, name: user.name }
    });
  }

  const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role, code: user.code };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const { password_hash, ...safeUser } = user;

  return res.status(200).json({ message: "Login successful", user: safeUser, token, requiresPasswordChange: false });
}

// ── Me ──
async function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ user: req.user });
}

// ── Change Initial Password ──
async function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { email: rawEmail, currentPassword, newPassword } = body || {};
  const email = rawEmail?.toLowerCase().trim();

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Email, current password, and new password are required' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include upper, lower, number, and symbol.' });
  }

  const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.active) return res.status(403).json({ error: 'Account is inactive or disabled' });
  if (!requiresInitialPasswordChange(user)) {
    return res.status(400).json({ error: 'Initial password change is not required for this account' });
  }

  const isValidCurrent = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidCurrent) return res.status(401).json({ error: 'Current password is incorrect' });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const { error: updateError } = await supabase.from('users')
    .update({
      password_hash: passwordHash,
      reset_password_token: null,
      reset_password_expires: null,
      has_changed_initial_password: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);
  if (updateError) throw updateError;

  const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role, code: user.code };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const { password_hash: _, ...safeUser } = user;

  return res.status(200).json({ message: 'Password changed successfully', token, user: safeUser });
}

// ── Forgot Password ──
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { email } = body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !user) return res.status(200).json({ message: "If that email exists, a reset link has been sent." });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = Date.now() + 3600000;

  const { error: updateError } = await supabase.from('users')
    .update({ reset_password_token: resetToken, reset_password_expires: resetTokenExpires })
    .eq('email', email);
  if (updateError) throw updateError;

  const reqOrigin = req?.headers?.origin || (req?.headers?.host ? `${req?.headers?.['x-forwarded-proto'] || 'https'}://${req?.headers?.host}` : null);
  const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || reqOrigin || 'http://localhost:5173').replace(/\/$/, '');
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

  try {
    await sendPasswordResetEmail({ to: email, resetLink });
  } catch (emailErr) {
    // Log server-side but don't expose email errors to the client.
    // The reset token is already saved — the user can still reset via the link if delivered.
    console.error('[forgot-password] Failed to send reset email to', email, ':', emailErr.message);
  }

  return res.status(200).json({ message: "If that email exists, a reset link has been sent." });
}

// ── Reset Password ──
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { token, newPassword } = body || {};
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a symbol." });
  }

  const { data: user, error } = await supabase.from('users').select('*').eq('reset_password_token', token).single();
  if (error || !user || parseInt(user.reset_password_expires) < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const { error: updateError } = await supabase.from('users')
    .update({
      password_hash: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null,
      has_changed_initial_password: true
    })
    .eq('id', user.id);
  if (updateError) throw updateError;

  return res.status(200).json({ message: "Password updated successfully" });
}

/**
 * Main router for the authentication API.
 * Uses query parameter `?action=...` to route to specific handlers.
 * 
 * Route: `/api/auth`
 * 
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handler(req, res) {
  const action = req.query?.action || '';

  try {
    switch (action) {
      case 'login':           return await handleLogin(req, res);
      case 'change-password': return await handleChangePassword(req, res);
      case 'forgot-password': return await handleForgotPassword(req, res);
      case 'reset-password':  return await handleResetPassword(req, res);
      case 'me':              return await handleMe(req, res);
      default:
        return res.status(400).json({ error: 'Unknown auth action. Use ?action=login|me|change-password|forgot-password|reset-password' });
    }
    } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message, stack: error.stack });
  }
}

// Login and forgot/reset don't require auth; me and change-password do.
// We handle auth selectively: wrap the handler but skip auth for public actions.
export default async function(req, res) {
  const action = req.query?.action || '';
  const publicActions = ['login', 'forgot-password', 'reset-password', 'change-password', ''];

  if (publicActions.includes(action)) {
    // For empty action, return a helpful error without requiring auth
    if (!action) {
      return res.status(400).json({ error: 'Missing ?action= parameter. Use login|me|change-password|forgot-password|reset-password' });
    }
    return handler(req, res);
  }

  // Wrap with auth for protected actions
  return withAuth(handler)(req, res);
}

