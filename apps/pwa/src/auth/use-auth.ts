import { useState, useEffect, useCallback } from 'react';
import {
  getSession,
  checkProfileCompletion,
  signOut as authSignOut,
  sendMagicLink as authSendMagicLink,
  onAuthStateChange,
  ProfileStatus,
} from './auth-service.ts';

export interface UseAuthState {
  user: any | null;
  session: any | null;
  loading: boolean;
  profileStatus: ProfileStatus | null;
  sendMagicLink: (email: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export function useAuth(): UseAuthState {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);

  const evaluateSession = useCallback(async (currentSession: any) => {
    setSession(currentSession);
    const currentUser = currentSession?.user || null;
    setUser(currentUser);

    if (currentUser?.id) {
      const status = await checkProfileCompletion(currentUser.id);
      setProfileStatus(status);
    } else {
      setProfileStatus(null);
    }
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    const activeSession = await getSession();
    await evaluateSession(activeSession);
  }, [evaluateSession]);

  useEffect(() => {
    let mounted = true;

    getSession().then((initialSession) => {
      if (mounted) {
        evaluateSession(initialSession);
      }
    });

    const { data: authListener } = onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        await evaluateSession(newSession);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [evaluateSession]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    setProfileStatus(null);
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    return authSendMagicLink(email);
  }, []);

  return {
    user,
    session,
    loading,
    profileStatus,
    sendMagicLink,
    signOut,
    refreshSession,
  };
}

export default useAuth;
