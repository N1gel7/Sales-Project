import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

export default function ResetPassword(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const navigate = useNavigate();

  // Inline strength hint
  function strengthHint(pw: string): string | null {
    if (!pw) return null;
    if (pw.length < 8) return 'At least 8 characters required.';
    if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter.';
    if (!/[a-z]/.test(pw)) return 'Add a lowercase letter.';
    if (!/[0-9]/.test(pw)) return 'Add a number.';
    if (!/[\W_]/.test(pw)) return 'Add a symbol (e.g. ! @ # $).';
    return null;
  }

  const hint = strengthHint(newPassword);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }

    const pwError = strengthHint(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
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
          Set a new password and get back to work.
        </p>
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
            <p className="text-sm text-muted-foreground">Set a new password</p>
          </div>

          <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-card p-6 shadow-sm">
            {done ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-green-light)] text-[var(--brand-green)]">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="page-title text-xl">Password updated!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Redirecting you to sign in…
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <h2 className="page-title text-xl">Set new password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a strong password for your account.
                  </p>
                </div>

                {!token && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>This reset link is invalid. Please <Link to="/login" className="underline">request a new one</Link>.</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">New password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-11 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                      placeholder="At least 8 characters"
                      required
                      disabled={!token}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {hint && newPassword && (
                    <p className="mt-1 text-xs text-amber-600">{hint}</p>
                  )}
                  {!hint && newPassword && (
                    <p className="mt-1 text-xs text-[var(--brand-green)]">Strong password ✓</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Confirm password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-11 text-sm shadow-[0_0_0_3px_rgba(99,153,34,0.08)] outline-none focus:border-[var(--brand-green)] focus:shadow-[0_0_0_3px_rgba(99,153,34,0.1)]"
                      placeholder="Re-enter your password"
                      required
                      disabled={!token}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-dark)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="font-medium text-[var(--brand-green)]">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
