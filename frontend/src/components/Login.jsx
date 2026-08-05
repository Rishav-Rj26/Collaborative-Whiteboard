import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="bg-surface-container-lowest w-full max-w-[1000px] rounded-xl shadow-obsidian overflow-hidden flex flex-col md:flex-row min-h-[640px] relative border border-outline-variant">
        
        {/* Left Side: Illustration */}
        <div className="hidden md:flex md:w-5/12 bg-surface-container-low relative items-center justify-center p-12 overflow-hidden border-r border-outline-variant">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50"></div>
          <div className="relative z-10 w-full flex flex-col items-center">
            {/* Abstract illustration placeholder */}
            <div className="w-full max-w-sm h-48 relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-2 border-primary/30 rounded-2xl rotate-12 relative">
                  <div className="absolute inset-4 border border-primary/20 rounded-xl -rotate-6"></div>
                  <div className="absolute inset-8 bg-primary/10 rounded-lg rotate-3"></div>
                </div>
                <div className="absolute top-4 right-12 w-3 h-3 rounded-full bg-tertiary/60"></div>
                <div className="absolute bottom-6 left-16 w-2 h-2 rounded-full bg-primary/60"></div>
                <div className="absolute top-12 left-8 w-16 h-1 bg-primary/20 rounded-full -rotate-12"></div>
                <div className="absolute bottom-10 right-8 w-12 h-1 bg-tertiary/20 rounded-full rotate-12"></div>
              </div>
            </div>
            <div className="text-center px-4">
              <h3 className="text-on-surface text-lg font-semibold tracking-tight">Visualize your workflow</h3>
              <p className="text-on-surface-variant text-sm mt-2">Connect ideas effortlessly with our developer-grade canvas.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-7/12 p-8 md:p-14 lg:p-20 flex flex-col justify-center bg-surface-container-lowest relative z-20">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-on-primary text-sm font-bold">B</span>
              </div>
              <span className="text-on-surface text-xl font-bold tracking-tight">Boardly</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-2">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-on-surface-variant">
              {isRegister ? 'Set up your workspace in seconds.' : 'Access your high-performance workspace.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg px-4 py-3 mb-6 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegister && (
              <div className="space-y-2">
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Full Name</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Developer"
                  required
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder-outline text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Email Address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@company.com"
                required
                className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder-outline text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Password</label>
                {!isRegister && (
                  <a className="text-xs text-primary hover:text-primary-fixed-dim transition-colors cursor-pointer">Reset password?</a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required minLength={6}
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder-outline text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full py-3 px-4 bg-primary text-on-primary text-sm font-bold rounded-lg hover:bg-primary-container transition-all shadow-lg shadow-primary/10 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Please wait...' : isRegister ? 'Create Account' : 'Continue to Dashboard'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-8 text-center">
            <p className="text-sm text-on-surface-variant">
              {isRegister ? 'Already have an account?' : 'New here?'}{' '}
              <button
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-primary font-semibold hover:underline transition-all ml-1"
              >
                {isRegister ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </div>

          {/* SSO Divider */}
          <div className="mt-10 flex items-center">
            <div className="flex-grow border-t border-outline-variant"></div>
            <span className="px-4 text-[10px] text-outline uppercase tracking-[0.2em] font-bold">Identity Provider</span>
            <div className="flex-grow border-t border-outline-variant"></div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-3 py-3 border border-outline-variant rounded-lg hover:bg-surface-container-high hover:border-outline transition-all text-sm text-on-surface font-medium">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-3 py-3 border border-outline-variant rounded-lg hover:bg-surface-container-high hover:border-outline transition-all text-sm text-on-surface font-medium">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>
              Single Sign-On
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
