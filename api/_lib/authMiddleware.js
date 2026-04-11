import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtConfig.js';

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
      // Allow preflight options immediately
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      // 1. Prefer Authorization: Bearer (SPA / localStorage) over cookies.
      //    Stale HttpOnly cookies from an old JWT_SECRET or session used to override
      //    a valid Bearer token and caused jwt.verify → "invalid signature".
      let token = null;
      const authHeader = req.headers['authorization'] || req.headers.authorization;
      if (typeof authHeader === 'string') {
        const m = /^Bearer\s+(\S+)/i.exec(authHeader.trim());
        if (m) token = m[1];
      }
      if (!token) {
        token = req.cookies?.authToken;
      }
      if (token) token = String(token).trim();

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
