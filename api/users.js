import { dbConnect } from './_lib/db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    try {
      const users = await User.find().select('_id name email code role createdAt').sort({ createdAt: -1 });
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
  
  return res.status(405).end();
}
