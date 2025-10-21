import { dbConnect } from './_lib/db.js';
import Session from '../models/Session.js';
import { verifyToken } from './_lib/sessionUtils.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Delete all sessions for this user
    await Session.deleteMany({ userId: user._id });

    res.json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to logout all sessions' });
  }
}
