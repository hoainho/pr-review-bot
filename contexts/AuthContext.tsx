import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  GoogleUser,
  initGoogleAuth,
  signIn as googleSignIn,
  signOut as googleSignOut,
  getStoredUser,
  isOAuthConfigured,
  onAuthStateChange,
} from '../services/googleAuth';

interface AuthContextType {
  user: GoogleUser | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured] = useState(() => isOAuthConfigured());

  useEffect(() => {
    async function init() {
      try {
        if (isConfigured) {
          await initGoogleAuth();
          const storedUser = getStoredUser();
          setUser(storedUser);
        }
      } catch (err) {
        console.error('Failed to initialize Google Auth:', err);
        setError('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) return;
    
    const unsubscribe = onAuthStateChange((newUser) => {
      setUser(newUser);
      setError(null);
    });
    
    return unsubscribe;
  }, [isConfigured]);

  const signIn = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const googleUser = await googleSignIn();
      setUser(googleUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    googleSignOut();
    setUser(null);
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isConfigured,
    signIn,
    signOut,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
