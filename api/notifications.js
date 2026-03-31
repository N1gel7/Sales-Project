import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  // Return empty notifications for now to prevent 404
  return res.status(200).json([]);
}


export default withAuth(handler);
