import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If we reach this handler, the token was successfully verified by withAuth Middleware.
  // We can just return the user payload contained inside req.user.
  
  // Optionally: Verify the user against the database to ensure they haven't been deleted or deactivated.
  // For standard JWT implementation with a stateless approach, returning the req.user is fine.
  
  return res.status(200).json({
    user: req.user
  });
}

// Wrap with custom generic Serverless auth middleware
export default withAuth(handler);
