import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building2 } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function Login() {
  const searchParams = new URLSearchParams(window.location.search);
  const resetToken = searchParams.get('reset_token');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupCurrentPassword, setSetupCurrentPassword] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [pendingProfile, setPendingProfile] = useState<{ id?: number | string; email?: string } | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset' | 'setup'>(
    resetToken ? 'reset' : 'login'
  );
  const { signIn, signInWithGoogle } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const setupSessionKey = 'rgi_pending_setup';

  useEffect(() => {
    const savedCredentials = localStorage.getItem('mysql_saved_credentials');
    if (savedCredentials) {
      try {
        const parsed = JSON.parse(savedCredentials) as { identifier?: string; email?: string; password?: string };
        const storedIdentifier = parsed.identifier || parsed.email;
        if (storedIdentifier) setIdentifier(storedIdentifier);
        if (parsed.password) setPassword(parsed.password);
        setRememberMe(true);
      } catch (err) {
        console.error('Failed to load saved credentials', err);
      }
    }
  }, []);

  useEffect(() => {
    const savedSetup = sessionStorage.getItem(setupSessionKey);
    if (!savedSetup) return;
    try {
      const parsed = JSON.parse(savedSetup) as { id?: number | string; email?: string };
      if (parsed?.id) {
        setPendingProfile(parsed);
        setMode('setup');
      }
    } catch (err) {
      console.error('Failed to restore setup session', err);
      sessionStorage.removeItem(setupSessionKey);
    }
  }, [setupSessionKey]);

  useEffect(() => {
    if (resetToken) {
      setMode('reset');
    }
  }, [resetToken]);

  useEffect(() => {
    if (!googleClientId || mode !== 'login') return;
    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      const buttonWidth = Math.floor(googleButtonRef.current.getBoundingClientRect().width) || 320;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            setError('');
            setMessage('');
            const result = await signInWithGoogle(response.credential);
            if (result.requiresSetup) {
              setPendingProfile(result.profile || null);
              setSetupCurrentPassword('');
              setSetupUsername('');
              setSetupPassword('');
              setSetupConfirm('');
              setMode('setup');
              if (result.profile?.id) {
                sessionStorage.setItem(setupSessionKey, JSON.stringify(result.profile));
              }
              setError('Akun Anda perlu setup username dan password sebelum login dengan Google.');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
          }
        },
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: buttonWidth,
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = () => {
        script?.setAttribute('data-loaded', 'true');
        initializeGoogle();
      };
      document.body.appendChild(script);
    } else if (script.hasAttribute('data-loaded')) {
      initializeGoogle();
    } else {
      script.onload = () => {
        script?.setAttribute('data-loaded', 'true');
        initializeGoogle();
      };
    }
  }, [googleClientId, mode, signInWithGoogle]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const result = await signIn(identifier, password);
      if (result.requiresSetup) {
        setPendingProfile(result.profile || null);
        setSetupCurrentPassword(password);
        setSetupUsername('');
        setSetupPassword('');
        setSetupConfirm('');
        setMode('setup');
        if (result.profile?.id) {
          sessionStorage.setItem(setupSessionKey, JSON.stringify(result.profile));
        }
        return;
      }
      if (rememberMe) {
        localStorage.setItem('mysql_saved_credentials', JSON.stringify({ identifier, password }));
      } else {
        localStorage.removeItem('mysql_saved_credentials');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to request reset password');
      }
      setMessage('Jika email terdaftar, link reset password sudah dikirim.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (resetPassword !== resetConfirm) {
      setError('Password dan konfirmasi tidak sama.');
      return;
    }
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to reset password');
      }
      setMessage('Password berhasil diubah. Silakan login kembali.');
      setMode('login');
      setResetPassword('');
      setResetConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (setupPassword !== setupConfirm) {
      setError('Password dan konfirmasi tidak sama.');
      return;
    }
    if (!pendingProfile?.id || !setupCurrentPassword) {
      setError('Sesi setup tidak valid, silakan login ulang.');
      setMode('login');
      sessionStorage.removeItem(setupSessionKey);
      return;
    }
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/auth/complete-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: pendingProfile.id,
          current_password: setupCurrentPassword,
          username: setupUsername,
          password: setupPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to complete setup');
      }

      const loginResult = await signIn(setupUsername, setupPassword);
      if (!loginResult.requiresSetup) {
        setMode('login');
        sessionStorage.removeItem(setupSessionKey);
        setPendingProfile(null);
        setSetupCurrentPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 dark:from-slate-950 dark:via-slate-900/80 dark:to-slate-900/60 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-slate-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 transform transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-br from-blue-600 to-emerald-600 p-3 rounded-2xl">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                RGI NexaProc
              </h1>
              <p className="text-sm text-gray-600 font-medium">Procurement Platform</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            {mode === 'login' && 'Sign In'}
            {mode === 'forgot' && 'Forgot Password'}
            {mode === 'reset' && 'Reset Password'}
            {mode === 'setup' && 'Setup Account'}
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {mode === 'login' && 'Sign in with your system account'}
            {mode === 'forgot' && 'Enter your email to receive reset instructions'}
            {mode === 'reset' && 'Set a new password for your account'}
            {mode === 'setup' && 'Buat username dan password baru untuk akun Anda'}
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm backdrop-blur-sm">
              {message}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="group">
                <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email or Username
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="email@company.com or username"
                  required
                />
              </div>

              <div className="group">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-700">
                <label className="inline-flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Save credentials
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setMessage('');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              {googleClientId && (
                <div className="pt-2">
                  <div ref={googleButtonRef} className="w-full" />
                </div>
              )}
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="group">
                <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setMessage('');
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-700 font-semibold"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="group">
                <label htmlFor="reset-password" className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="group">
                <label htmlFor="reset-confirm" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? 'Updating...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setMessage('');
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-700 font-semibold"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-5">
              <div className="group">
                <label htmlFor="setup-current-password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password Default
                </label>
                <input
                  id="setup-current-password"
                  type="password"
                  value={setupCurrentPassword}
                  onChange={(e) => setSetupCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="Masukkan password default Anda"
                  required
                />
              </div>
              <div className="group">
                <label htmlFor="setup-username" className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  id="setup-username"
                  type="text"
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="username"
                  required
                />
              </div>

              <div className="group">
                <label htmlFor="setup-password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password Baru
                </label>
                <input
                  id="setup-password"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="group">
                <label htmlFor="setup-confirm" className="block text-sm font-semibold text-gray-700 mb-2">
                  Konfirmasi Password
                </label>
                <input
                  id="setup-confirm"
                  type="password"
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? 'Saving...' : 'Simpan Username & Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6 font-medium">
          RGI NexaProc Procurement Suite
        </p>
      </div>
    </div>
  );
}
