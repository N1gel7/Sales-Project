import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Mail, Lock, LogIn, Eye, EyeOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEMO = {
  admin: { email: 'admin@example.com', password: 'Admin#123' },
  manager: { email: 'manager@example.com', password: 'Manager#123' },
  sales: { email: 'rep1@example.com', password: 'Rep#123' },
};

export default function Login(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [pwStrength, setPwStrength] = useState<string | null>(null);
  const [successCheck, setSuccessCheck] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotErr, setForgotErr] = useState<string | null>(null);
  const [roleHint, setRoleHint] = useState<'admin' | 'manager' | 'sales' | null>(null);

  const navigate = useNavigate();

  React.useEffect(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
  }, []);

  function validateNewPw(a: string, b: string): string | null {
    if (a.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(a) || !/[a-z]/.test(a) || !/[0-9]/.test(a)) {
      return 'Include uppercase, lowercase, and a number.';
    }
    if (a !== b) return 'Passwords do not match.';
    return null;
  }

  React.useEffect(() => {
    if (!requiresPasswordChange || !newPassword) {
      setPwStrength(null);
      return;
    }
    const v = validateNewPw(newPassword, confirmPassword);
    setPwStrength(v);
  }, [newPassword, confirmPassword, requiresPasswordChange]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim().toLowerCase(), password);

      if (res?.requiresPasswordChange) {
        setRequiresPasswordChange(true);
        setPasswordChangeError(null);
        return;
      }

      if (!res || !res.token) {
        throw new Error('Invalid authentication response from server');
      }

      localStorage.setItem('auth_token', res.token);
      if (res.user) {
        localStorage.setItem('user_info', JSON.stringify(res.user));
      }
      navigate('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function onInitialPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordChangeError(null);
    const v = validateNewPw(newPassword, confirmPassword);
    if (v) {
      setPasswordChangeError(v);
      return;
    }

    setLoading(true);
    try {
      const res = await api.changeInitialPassword(email.trim().toLowerCase(), password, newPassword);
      if (!res?.token) {
        throw new Error('Password changed, but login token was not returned.');
      }
      setSuccessCheck(true);
      localStorage.setItem('auth_token', res.token);
      if (res.user) {
        localStorage.setItem('user_info', JSON.stringify(res.user));
      }
      window.setTimeout(() => navigate('/'), 900);
    } catch (e: unknown) {
      setPasswordChangeError(e instanceof Error ? e.message : 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotErr(null);
    setForgotLoading(true);
    try {
      await api.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotDone(true);
    } catch (err: unknown) {
      setForgotErr(err instanceof Error ? err.message : 'Could not send reset link.');
    } finally {
      setForgotLoading(false);
    }
  }

  const leftPanel = (
    <div className="relative hidden min-h-screen w-[44%] flex-col justify-center overflow-hidden bg-[var(--brand-dark)] lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #639922 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full opacity-35 blur-3xl"
        style={{ background: 'radial-gradient(circle, #378add 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-md px-10 py-12">
        <p className="mb-2 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-[rgba(242,240,234,0.55)]">
          Field intelligence
        </p>
        <h1 className="page-title text-4xl text-[rgba(242,240,234,0.98)]">SalesOps</h1>
        <p className="mt-4 text-sm leading-relaxed text-[rgba(242,240,234,0.72)]">
          One workspace for revenue, tasks, and field media — tuned for distributed teams.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[rgba(242,240,234,0.85)]">
            99.9% uptime
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[rgba(242,240,234,0.85)]">
            1.4× close-rate lift
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface)] lg:flex-row">
      {leftPanel}

      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="page-title text-3xl text-[var(--brand-dark)]">SalesOps</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(['admin', 'manager', 'sales'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleHint(r);
                  setEmail(DEMO[r].email);
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  roleHint === r
                    ? 'border-[var(--brand-green)] bg-[var(--brand-green-light)] text-[var(--brand-green-dark)]'
                    : 'border-border bg-background text-muted-foreground hover:border-[var(--brand-green)]/40'
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {forgotMode ? (
            <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-card p-6 shadow-sm">
              {forgotDone ? (
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-green-light)] text-[var(--brand-green)]">
                    <Check className="h-6 w-6" />
                  </div>
                  <h2 className="page-title text-xl">Check your inbox</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    If an account exists for that email, we sent a reset link.
                  </p>
                  <button
                    type="button"
                    className="mt-6 text-sm font-medium text-[var(--brand-green)]"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotDone(false);
                      setForgotEmail('');
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={onForgot} className="space-y-4">
                  <h2 className="page-title text-xl">Reset password</h2>
                  {forgotErr && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {forgotErr}
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.1)] outline-none focus:border-[var(--brand-green)]"
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full rounded-lg bg-[var(--brand-dark)] py-2.5 text-sm font-medium text-white"
                  >
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                  <button
                    type="button"
                    className="w-full text-center text-sm text-[var(--brand-green)]"
                    onClick={() => setForgotMode(false)}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form
              onSubmit={requiresPasswordChange ? onInitialPasswordChange : onSubmit}
              className="rounded-xl border border-[var(--color-border-tertiary)] bg-card p-6 shadow-sm"
            >
              <h2 className="page-title text-xl text-foreground">
                {requiresPasswordChange ? 'Set a new password' : 'Welcome back'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {requiresPasswordChange
                  ? 'Your administrator requires a new password before you continue.'
                  : 'Sign in with your work email.'}
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                      placeholder="you@company.com"
                      required
                      disabled={requiresPasswordChange && successCheck}
                    />
                  </div>
                </div>

                {!requiresPasswordChange && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Password</label>
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--brand-green)]"
                        onClick={() => setForgotMode(true)}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-11 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {requiresPasswordChange && (
                  <>
                    {passwordChangeError && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {passwordChangeError}
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium">New password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                        placeholder="At least 8 characters"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Confirm password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                        required
                      />
                    </div>
                    {pwStrength && <p className="text-xs text-amber-700">{pwStrength}</p>}
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading || successCheck}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-dark)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {successCheck ? (
                    <>
                      <Check className="h-4 w-4 text-[var(--brand-green)]" />
                      Saved — redirecting…
                    </>
                  ) : loading ? (
                    'Please wait…'
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      {requiresPasswordChange ? 'Update password' : 'Sign in'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
