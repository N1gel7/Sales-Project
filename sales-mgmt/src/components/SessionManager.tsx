import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Session {
  id: string;
  token: string;
  createdAt: string;
  lastAccessed: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: string;
}

export const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getSessions() as Session[];
      setSessions(data);
      setError(null);
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (token: string) => {
    try {
      await api.revokeSession(token);
      await loadSessions(); // Reload sessions
    } catch (err) {
      setError('Failed to revoke session');
      console.error('Error revoking session:', err);
    }
  };

  const logoutAll = async () => {
    if (window.confirm('Are you sure you want to logout from all devices?')) {
      try {
        await api.logoutAll();
        // Redirect to login page
        window.location.href = '/login';
      } catch (err) {
        setError('Failed to logout from all devices');
        console.error('Error logging out from all devices:', err);
      }
    }
  };

  const extendSession = async () => {
    try {
      await api.extendSession(24); // Extend by 24 hours
      await loadSessions(); // Reload sessions
    } catch (err) {
      setError('Failed to extend session');
      console.error('Error extending session:', err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  if (loading) {
    return <div className="p-4">Loading sessions...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Active Sessions</h2>
        <div className="space-x-2">
          <button
            onClick={extendSession}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Extend Current Session
          </button>
          <button
            onClick={logoutAll}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout All Devices
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sessions.map((session) => (
            <li key={session.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {session.userAgent || 'Unknown Device'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session.token}
                    </p>
                  </div>
                  <div className="mt-1">
                    <p className="text-sm text-gray-500">
                      IP: {session.ipAddress || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Last accessed: {new Date(session.lastAccessed).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires: {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => revokeSession(session.token)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {sessions.length === 0 && (
          <div className="px-6 py-4 text-center text-gray-500">
            No active sessions found.
          </div>
        )}
      </div>
    </div>
  );
};
