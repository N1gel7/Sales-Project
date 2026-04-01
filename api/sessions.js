import { withAuth } from './_lib/authMiddleware.js';

/**
 * Sessions handler — with JWT auth, sessions are stateless.
 * This handler exists for API compatibility.
 */
async function handler(req, res) {
  const { method } = req;

  // With JWT-based auth, there are no server-side sessions to manage.
  // These endpoints exist for frontend compatibility.

  if (method === 'GET') {
    // Return the current token session info from the decoded JWT
    return res.json([{
      id: 'current',
      token: req.headers.authorization?.split(' ')[1]?.substring(0, 8) + '...',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      expiresAt: req.user?.exp ? new Date(req.user.exp * 1000).toISOString() : null,
      userAgent: req.headers['user-agent'] || 'unknown'
    }]);
  }

  if (method === 'POST') {
    // "Extend session" — with JWT this is a no-op; token expiry is fixed at sign time
    return res.json({ message: 'Session info retrieved (JWT-based, stateless)' });
  }

  if (method === 'DELETE') {
    // Logout is handled client-side by removing the token
    return res.json({ message: 'Logged out (token should be removed client-side)' });
  }

  return res.status(405).end();
}

export default withAuth(handler);
