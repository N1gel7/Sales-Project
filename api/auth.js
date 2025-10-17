import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbConnect } from './_lib/db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  if (req.method === 'POST') {
    const { type, name, email, password } = req.body || {};
    if (type === 'signup') {
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'User exists' });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash, role: 'sales' });
      return res.status(201).json({ id: user._id });
    }
    if (type === 'login') {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid' });
      const token = jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ token });
    }
    return res.status(400).json({ error: 'Unsupported type' });
  }
  return res.status(405).end();
}


