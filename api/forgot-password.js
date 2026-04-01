import supabase from './_lib/supabase.js';
import crypto from 'crypto';
import { Resend } from 'resend';

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

    const { email } = body || {};
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      // Return 200 even if user not found to prevent email enumeration
      return res.status(200).json({ message: "If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Date.now() + 3600000; // 1 hour

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: resetToken,
        reset_password_expires: resetTokenExpires
      })
      .eq('email', email);

    if (updateError) {
      throw updateError;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Lumi - Password Reset',
      html: `<p>You requested a password reset. Click the link below to reset it:</p><br><a href="${resetLink}">Reset Password</a><br><p>This link expires in 1 hour.</p>`
    });

    return res.status(200).json({ message: "If that email exists, a reset link has been sent." });

  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
