import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login(email.trim().toLowerCase(), password);
      localStorage.setItem('auth_token', res.token);
      // Store user info for display
      localStorage.setItem('user_info', JSON.stringify(res.user));
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-10">
        <div className="max-w-md m-auto space-y-4">
          <div className="text-3xl font-semibold">Sales Manager</div>
          <div className="text-sm text-blue-100">Field ops, tasks, uploads, and invoicing — all in one place.</div>
          <ul className="space-y-2 text-blue-100 text-sm list-disc list-inside">
            <li>Track on-ground performance</li>
            <li>Assign and complete tasks</li>
            <li>Capture media with geolocation</li>
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center bg-gray-50 p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm card">
          <div className="card-header">Sign in</div>
          <div className="card-body space-y-3">
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <input className="h-11 w-full border border-gray-200 rounded-md px-3 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="h-11 w-full border border-gray-200 rounded-md px-3 text-sm" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="h-11 w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm">Login</button>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Demo users:</div>
              <div>Admin: admin@example.com / Admin#123</div>
              <div>Manager: manager@example.com / Manager#123</div>
              <div>Sales: rep1@example.com / Rep#123</div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


