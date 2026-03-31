import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json([]); // No sessions in mock mode
  }
  if (req.method === 'POST') {
    return res.json({ message: 'Session extended (mock)' });
  }
  if (req.method === 'DELETE') {
    return res.json({ message: 'Logged out (mock)' });
  }
  return res.status(405).end();
}


export default withAuth(handler);
