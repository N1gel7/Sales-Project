import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { type } = req.query || req.body || {};
  
  if (type === 'notifications') return res.json([]);
  if (type === 'chats') return res.json([]);
  if (type === 'reports') return res.json([]);
  if (type === 'uploads') return res.json([{ _id: 'up_1', filename: 'Mock General.pdf', createdAt: new Date() }]);
  if (type === 'logout-all') return res.json({ message: 'Logged out all (mock)' });
  
  // Also handle path-based for legacy/direct calls
  const urlPath = req.url.split('?')[0];
  if (urlPath.includes('/notifications')) return res.json([]);
  if (urlPath.includes('/chats')) return res.json([]);
  if (urlPath.includes('/uploads')) return res.json([{ _id: 'up_1', filename: 'Mock Path.pdf', createdAt: new Date() }]);

  return res.status(200).json({ status: 'ok', message: 'General mock handler' });
}


export default withAuth(handler);
