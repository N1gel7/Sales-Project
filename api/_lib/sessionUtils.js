import Session from '../../models/Session.js';

/**
 * Clean up expired sessions
 * This function should be called periodically to remove expired sessions
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await Session.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    console.log(`Cleaned up ${result.deletedCount} expired sessions`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
}

/**
 * Get active sessions for a user
 */
export async function getUserSessions(userId) {
  try {
    const sessions = await Session.find({
      userId,
      expiresAt: { $gt: new Date() }
    }).sort({ lastAccessed: -1 });
    
    return sessions.map(session => ({
      id: session._id,
      token: session.token.substring(0, 8) + '...', // Only show first 8 chars for security
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt
    }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    throw error;
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(token) {
  try {
    const result = await Session.deleteOne({ token });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error revoking session:', error);
    throw error;
  }
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId) {
  try {
    const result = await Session.deleteMany({ userId });
    return result.deletedCount;
  } catch (error) {
    console.error('Error revoking all user sessions:', error);
    throw error;
  }
}

/**
 * Extend session expiration
 */
export async function extendSession(token, hours = 24) {
  try {
    const session = await Session.findOne({ 
      token, 
      expiresAt: { $gt: new Date() } 
    });
    
    if (!session) {
      return false;
    }
    
    session.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    session.lastAccessed = new Date();
    await session.save();
    
    return true;
  } catch (error) {
    console.error('Error extending session:', error);
    throw error;
  }
}
