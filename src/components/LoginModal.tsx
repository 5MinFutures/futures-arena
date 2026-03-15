import { useState } from 'react';
import { supabase } from '../supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'login' | 'signup';

const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [view, setView] = useState<ModalView>('login');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const switchView = (next: ModalView) => {
    setView(next);
    setEmail('');
    setError(null);
    setSent(false);
  };

  const isLogin = view === 'login';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        {sent ? (
          <div className="text-center py-4">
            <h2 className="text-lg font-bold mb-2">Check your email</h2>
            <p className="text-gray-600 text-sm">
              A magic link has been sent to <strong>{email}</strong>. Click the link to sign in.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim()}
              className="w-full px-4 py-2 min-h-[44px] bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
            >
              {loading ? 'Sending...' : isLogin ? 'Send Magic Link' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-gray-500">
              {isLogin ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => switchView('signup')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign up for free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchView('login')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
