import supabase from './_lib/supabase.js';
import bcrypt from 'bcryptjs';

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

    const { token, newPassword } = body || {};
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password required" });
    }

    // Server-side strict validation match from the user's snippet
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a symbol." });
    }

    // find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('reset_password_token', token)
      .single();

    // Check expiration or existence
    if (error || !user || parseInt(user.reset_password_expires) < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash the new password 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update with Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ message: "Password updated successfully" });

  } catch (error) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
