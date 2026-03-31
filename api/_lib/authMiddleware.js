import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';

/**
 * Serverless middleware to protect private API routes.
 * Wraps your actual handler function and ensures the request has a valid JWT.
 * 
 * @param {Function} handler - The Next.js / Serverless API handler
 * @returns {Function} - The wrapped handler
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Allow preflight options
      if (req.method === 'OPTIONS') {
        return handler(req, res);
      }

      // 1. Get auth header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      }

      const token = authHeader.split(' ')[1];

      // 2. Verify Token
      const decodedUser = jwt.verify(token, JWT_SECRET);

      // 3. Attach user to req to be used by the handler
      req.user = decodedUser;

      // 4. Continue to the original handler
      return await handler(req, res);
    } catch (error) {
      console.error('Auth Middleware Error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Unauthorized: Token expired' });
      }
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };
}
