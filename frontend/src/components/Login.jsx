import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Info } from 'lucide-react';
import BoardlyLogo from './BoardlyLogo';

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
            {/* Logo */}
            <div className="w-full max-w-sm h-48 relative mb-8 flex items-center justify-center">
              <BoardlyLogo size={160} />
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
              <BoardlyLogo size={32} />
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
                  <span className="text-xs text-outline-variant flex items-center gap-1 cursor-help" title="Password reset coming soon"><Info size={12}/> Reset password?</span>
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

        </div>
      </div>
    </div>
  );
}
