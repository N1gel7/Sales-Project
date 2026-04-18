/**
 * Single source of truth for JWT signing/verification (login + authMiddleware).
 * Keeps login and protected routes aligned.
 */
function normalizeEnvString(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

const rawSecret = normalizeEnvString(process.env.JWT_SECRET);
if (!rawSecret) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}
export const JWT_SECRET = rawSecret;
export const JWT_EXPIRES_IN = normalizeEnvString(process.env.JWT_EXPIRES_IN) || '24h';
