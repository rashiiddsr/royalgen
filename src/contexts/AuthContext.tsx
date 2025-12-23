/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile } from '../lib/api';

interface AuthContextType {
  user: { email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SESSION_STORAGE_KEY = 'mysql_session_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadSession = (): UserProfile | null => {
  const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedSession) return null;

  try {
    return JSON.parse(storedSession);
  } catch (error) {
    console.error('Failed to parse session', error);
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionProfile = loadSession();
    if (sessionProfile) {
      setUser({ email: sessionProfile.email });
      setProfile(sessionProfile);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Invalid email or password');
    }

    const sessionProfile: UserProfile = data.profile;

    setUser({ email: sessionProfile.email });
    setProfile(sessionProfile);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionProfile));
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
