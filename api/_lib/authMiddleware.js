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

      // 1. Get auth token (checking cookies first, fallback to header)
      let token = req.cookies?.authToken;

      if (!token) {
        const authHeader = req.headers['authorization'] || req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Access token is required' });
      }

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

/**
 * Role-Based Access Control (RBAC) middleware.
 * Wraps a handler with withAuth AND checks the user's role.
 * 
 * Usage:
 *   export default withRole('admin', 'manager')(handler);
 * 
 * @param  {...string} allowedRoles - Roles permitted to access this endpoint
 * @returns {Function} - A function that wraps the handler
 */
export function withRole(...allowedRoles) {
  return (handler) => {
    return withAuth(async (req, res) => {
      const userRole = req.user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Forbidden: You do not have permission to access this resource' 
        });
      }
      return handler(req, res);
    });
  };
}
