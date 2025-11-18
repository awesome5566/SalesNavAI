import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface ConnectivityTestResult {
  success: boolean;
  error?: string;
  details?: {
    status?: number;
    statusText?: string;
    duration?: number;
    supabaseDomain?: string;
    errorName?: string;
    navigator?: {
      onLine: boolean;
    };
  };
}

interface ClassifiedError {
  type: string;
  message: string;
  details: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  testConnectivity: () => Promise<ConnectivityTestResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Error classification helper
const classifyError = (error: any): ClassifiedError => {
  const errorMessage = error?.message || String(error);
  const errorName = error?.name || '';

  // Network errors
  if (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    (errorName === 'TypeError' && errorMessage.includes('fetch'))
  ) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Network connection failed. This may be due to firewall, proxy, or network restrictions.',
      details: {
        originalError: errorMessage,
        errorName,
        stack: error?.stack,
        cause: error?.cause,
      },
    };
  }

  // CORS errors
  if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
    return {
      type: 'CORS_ERROR',
      message: 'CORS policy blocked the request. Check if Supabase URL is whitelisted.',
      details: {
        originalError: errorMessage,
        errorName,
      },
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
    return {
      type: 'TIMEOUT_ERROR',
      message: 'Request timed out. Network may be slow or blocked.',
      details: {
        originalError: errorMessage,
        errorName,
      },
    };
  }

  // SSL/TLS errors
  if (
    errorMessage.includes('SSL') ||
    errorMessage.includes('TLS') ||
    errorMessage.includes('certificate')
  ) {
    return {
      type: 'SSL_ERROR',
      message: 'SSL/TLS certificate issue. Corporate proxy may be intercepting HTTPS.',
      details: {
        originalError: errorMessage,
        errorName,
      },
    };
  }

  // Supabase API errors
  if (error?.status || error?.code) {
    return {
      type: 'API_ERROR',
      message: error?.message || 'Authentication API error',
      details: {
        status: error?.status,
        code: error?.code,
        originalError: errorMessage,
      },
    };
  }

  // Unknown errors
  return {
    type: 'UNKNOWN_ERROR',
    message: errorMessage || 'An unexpected error occurred',
    details: {
      originalError: errorMessage,
      errorName,
      fullError: error,
    },
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Initializing auth…');

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('[AuthContext] getSession error:', error);
        }
        console.log('[AuthContext] Session loaded:', session ? 'user present' : 'no session');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AuthContext] CRITICAL getSession failure:', err);
        setLoading(false);
      });

    // Listen for auth changes
    console.log('[AuthContext] Subscribing to auth state changes');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth event:', event, session ? 'user present' : 'no user');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[AuthContext] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  const testConnectivity = async (): Promise<ConnectivityTestResult> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return {
        success: false,
        error: 'Supabase URL not configured',
      };
    }

    const testUrl = `${supabaseUrl}/rest/v1/`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      const result: ConnectivityTestResult = {
        success: response.ok || response.status === 404, // 404 is OK, means server is reachable
        details: {
          status: response.status,
          statusText: response.statusText,
          duration,
          supabaseDomain: new URL(supabaseUrl).hostname,
        },
      };

      console.log('[AuthContext] Connectivity test result:', result);
      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const classified = classifyError(err);

      console.error('[AuthContext] Connectivity test failed:', {
        ...classified,
        duration,
        supabaseDomain: new URL(supabaseUrl).hostname,
      });

      return {
        success: false,
        error: classified.message,
        details: {
          ...classified.details,
          duration,
          supabaseDomain: new URL(supabaseUrl).hostname,
          navigator: {
            onLine: navigator.onLine,
          },
        },
      };
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : 'unknown';

    console.log('[AuthContext] Sign-in attempt started', {
      email: email.substring(0, 3) + '***', // Partial email for privacy
      supabaseDomain,
      timestamp: new Date().toISOString(),
    });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const classified = classifyError(error);
        console.error('[AuthContext] Sign-in error:', {
          ...classified,
          supabaseDomain,
          timestamp: new Date().toISOString(),
        });

        const enhancedError = new Error(classified.message) as any;
        enhancedError.type = classified.type;
        enhancedError.details = classified.details;
        enhancedError.originalError = error;
        throw enhancedError;
      }

      console.log('[AuthContext] Sign-in successful', {
        email: email.substring(0, 3) + '***',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      // Handle network errors that might not be caught by Supabase
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        const classified = classifyError(err);
        console.error('[AuthContext] Network error during sign-in:', {
          ...classified,
          supabaseDomain,
          timestamp: new Date().toISOString(),
          navigator: {
            onLine: navigator.onLine,
            userAgent: navigator.userAgent,
          },
        });

        const enhancedError = new Error(classified.message) as any;
        enhancedError.type = classified.type;
        enhancedError.details = classified.details;
        enhancedError.originalError = err;
        throw enhancedError;
      }

      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : 'unknown';

    console.log('[AuthContext] Sign-up attempt started', {
      email: email.substring(0, 3) + '***', // Partial email for privacy
      supabaseDomain,
      timestamp: new Date().toISOString(),
    });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        const classified = classifyError(error);
        console.error('[AuthContext] Sign-up error:', {
          ...classified,
          supabaseDomain,
          timestamp: new Date().toISOString(),
        });

        const enhancedError = new Error(classified.message) as any;
        enhancedError.type = classified.type;
        enhancedError.details = classified.details;
        enhancedError.originalError = error;
        throw enhancedError;
      }

      console.log('[AuthContext] Sign-up successful', {
        userId: data?.user?.id,
        email: data?.user?.email?.substring(0, 3) + '***',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      // Handle network errors that might not be caught by Supabase
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        const classified = classifyError(err);
        console.error('[AuthContext] Network error during sign-up:', {
          ...classified,
          supabaseDomain,
          timestamp: new Date().toISOString(),
          navigator: {
            onLine: navigator.onLine,
            userAgent: navigator.userAgent,
          },
        });

        const enhancedError = new Error(classified.message) as any;
        enhancedError.type = classified.type;
        enhancedError.details = classified.details;
        enhancedError.originalError = err;
        throw enhancedError;
      }

      throw err;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    testConnectivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

