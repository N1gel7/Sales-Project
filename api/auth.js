import { dbConnect } from './_lib/db.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'POST') {
    const { type, name, email, password, role, code } = req.body || {};
    
    // Handle signup
    if (type === 'signup') {
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'User exists' });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ 
        name, 
        email, 
        passwordHash, 
        role: role || 'sales',
        code: code || `SS${Date.now().toString().slice(-6)}`
      });
      
      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await Session.create({
        token,
        userId: user._id,
        expiresAt,
        userAgent: req.get('User-Agent') || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress
      });
      
      return res.status(201).json({ 
        token, 
        user: { 
          id: user._id, 
          name: user.name, 
          role: user.role, 
          code: user.code, 
          email: user.email 
        } 
      });
    }
    
    if (type === 'login') {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid' });
      
      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await Session.create({
        token,
        userId: user._id,
        expiresAt,
        userAgent: req.get('User-Agent') || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress
      });
      
      return res.status(200).json({ 
        token, 
        user: { 
          id: user._id, 
          name: user.name, 
          role: user.role, 
          code: user.code, 
          email: user.email 
        } 
      });
    }
    
    return res.status(400).json({ error: 'Unsupported type' });
  }
  
  return res.status(405).end();
}
