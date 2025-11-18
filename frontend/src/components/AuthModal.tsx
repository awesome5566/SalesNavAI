import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signIn' | 'signUp';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signIn' }) => {
  const { signInWithEmail, signUpWithEmail, testConnectivity } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signUp');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(initialMode === 'signUp');
      setEmail('');
      setPassword('');
      setError(null);
      setErrorDetails(null);
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setErrorDetails(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);
    setLoading(true);

    try {
      // Test connectivity first if it's a sign-up
      if (isSignUp) {
        setTestingConnection(true);
        const connectivityTest = await testConnectivity();
        setTestingConnection(false);

        if (!connectivityTest.success) {
          setError('Cannot connect to authentication server');
          setErrorDetails(
            `Network test failed: ${connectivityTest.error}\n\n` +
            `This usually means:\n` +
            `• Corporate firewall is blocking the connection\n` +
            `• Network proxy needs configuration\n` +
            `• VPN is restricting access\n\n` +
            `Check the browser console (F12) for detailed error information.`
          );
          setLoading(false);
          return;
        }
      }

      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      handleClose();
    } catch (err: any) {
      const errorType = err?.type || 'UNKNOWN';
      let userMessage = err?.message || 'Failed to authenticate';
      let details = null;

      // Provide specific guidance based on error type
      switch (errorType) {
        case 'NETWORK_ERROR':
          userMessage = 'Network connection failed';
          details =
            `Unable to reach the authentication server.\n\n` +
            `Possible causes:\n` +
            `• Corporate firewall blocking external connections\n` +
            `• Network proxy intercepting requests\n` +
            `• VPN restrictions\n\n` +
            `Try:\n` +
            `• Switching to a different network (mobile hotspot)\n` +
            `• Contacting IT to whitelist Supabase domains\n` +
            `• Checking browser console (F12) for details`;
          break;
        case 'CORS_ERROR':
          userMessage = 'CORS policy blocked the request';
          details =
            'The server is blocking cross-origin requests. This may require IT configuration.';
          break;
        case 'TIMEOUT_ERROR':
          userMessage = 'Request timed out';
          details =
            'The server took too long to respond. Network may be slow or blocked.';
          break;
        case 'SSL_ERROR':
          userMessage = 'SSL/TLS certificate issue';
          details =
            `Certificate validation failed. This often happens when:\n` +
            `• Corporate proxy intercepts HTTPS\n` +
            `• SSL inspection is enabled\n\n` +
            `Contact IT about proxy configuration.`;
          break;
        default:
          details = err?.details
            ? JSON.stringify(err.details, null, 2)
            : null;
      }

      setError(userMessage);
      if (details) {
        setErrorDetails(details);
      }

      // Log full error for debugging
      console.error('[AuthModal] Authentication error:', {
        errorType,
        message: err?.message,
        details: err?.details,
        originalError: err?.originalError,
        stack: err?.stack,
      });
    } finally {
      setLoading(false);
      setTestingConnection(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          ✕
        </button>
        
        <div className="modal-header">
          <h2>{isSignUp ? 'Create an account' : 'Sign in to continue'}</h2>
          <p>{isSignUp ? 'Start using SalesNav AI today' : 'Create an account or sign in to access search features'}</p>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {error && (
              <div className="error-message">
                <strong>{error}</strong>
                {errorDetails && (
                  <pre
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '200px',
                      overflow: 'auto',
                      padding: '8px',
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: '4px',
                    }}
                  >
                    {errorDetails}
                  </pre>
                )}
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={loading || testingConnection}
            >
              {testingConnection
                ? 'Testing connection...'
                : loading
                  ? 'Loading...'
                  : isSignUp
                    ? 'Sign Up'
                    : 'Sign In'}
            </button>
          </form>

          <div className="auth-switch">
            <span>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setErrorDetails(null);
                }}
                className="link-button"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </span>
          </div>

          <div className="terms">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
};

