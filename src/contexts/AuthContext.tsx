/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile } from '../lib/api';

interface AuthContextType {
  user: { email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ requiresSetup: boolean; profile?: UserProfile }>;
  signInWithGoogle: (credential: string) => Promise<{ requiresSetup: boolean; profile?: UserProfile }>;
  signOut: () => Promise<void>;
  setProfileState: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const SESSION_KEY = 'rgi_session_profile';
  const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

  type StoredSession = {
    profile: UserProfile;
    expiresAt: string;
  };

  useEffect(() => {
    const savedProfile = localStorage.getItem(SESSION_KEY);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as StoredSession | UserProfile;
        const sessionProfile = 'profile' in parsed ? parsed.profile : parsed;
        const expiresAt = 'expiresAt' in parsed ? new Date(parsed.expiresAt).getTime() : 0;

        if (expiresAt && expiresAt < Date.now()) {
          localStorage.removeItem(SESSION_KEY);
        } else if (sessionProfile?.email) {
          setUser({ email: sessionProfile.email });
          setProfile(sessionProfile);
          if (!expiresAt) {
            localStorage.setItem(
              SESSION_KEY,
              JSON.stringify({
                profile: sessionProfile,
                expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
              })
            );
          }
        }
      } catch (error) {
        console.error('Failed to restore session', error);
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (identifier: string, password: string) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Invalid email or password');
    }

    const sessionProfile: UserProfile = data.profile;
    const requiresSetup = Boolean(data?.requires_setup);

    if (requiresSetup) {
      return { requiresSetup, profile: sessionProfile };
    }

    setUser({ email: sessionProfile.email });
    setProfile(sessionProfile);
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        profile: sessionProfile,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
    );
    return { requiresSetup: false, profile: sessionProfile };
  };

  const signInWithGoogle = async (credential: string) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const response = await fetch(`${apiBase}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to sign in with Google');
    }

    const sessionProfile: UserProfile = data.profile;
    const requiresSetup = Boolean(data?.requires_setup);

    if (requiresSetup) {
      return { requiresSetup, profile: sessionProfile };
    }

    setUser({ email: sessionProfile.email });
    setProfile(sessionProfile);
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        profile: sessionProfile,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
    );
    return { requiresSetup: false, profile: sessionProfile };
  };

  const signOut = async () => {
    const userId = profile?.id;
    setUser(null);
    setProfile(null);
    localStorage.removeItem(SESSION_KEY);

    if (userId) {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
      } catch (error) {
        console.error('Logout activity failed', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signInWithGoogle, signOut, setProfileState: setProfile }}
    >
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
