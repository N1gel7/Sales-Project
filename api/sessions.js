import { dbConnect } from './_lib/db.js';
import Session from '../models/Session.js';
import { getUserSessions, revokeSession, revokeAllUserSessions, extendSession } from './_lib/sessionUtils.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    // Get user's active sessions
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const session = await Session.findOne({ 
      token, 
      expiresAt: { $gt: new Date() } 
    }).populate('userId');
    
    if (!session) return res.status(401).json({ error: 'Invalid or expired token' });
    
    const sessions = await getUserSessions(session.userId._id);
    res.json(sessions);
  }
  
  if (req.method === 'POST') {
    // Extend session
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const { hours = 24 } = req.body;
    const success = await extendSession(token, hours);
    
    if (success) {
      res.json({ message: 'Session extended successfully' });
    } else {
      res.status(400).json({ error: 'Failed to extend session' });
    }
  }
  
  if (req.method === 'DELETE') {
    // Revoke session or logout all
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const session = await Session.findOne({ 
      token, 
      expiresAt: { $gt: new Date() } 
    }).populate('userId');
    
    if (!session) return res.status(401).json({ error: 'Invalid or expired token' });
    
    const { all } = req.query;
    
    if (all === 'true') {
      const deletedCount = await revokeAllUserSessions(session.userId._id);
      res.json({ message: `Logged out from ${deletedCount} devices successfully` });
    } else {
      const success = await revokeSession(token);
      if (success) {
        res.json({ message: 'Session revoked successfully' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    }
  }
  
  return res.status(405).end();
}
