import { useState, useEffect, useCallback, useRef } from 'react';
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
  isLoading: boolean;
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

  const lastUserIdRef = useRef<string | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const profileStatusRef = useRef<ProfileStatus | null>(null);

  const evaluateSession = useCallback(async (currentSession: any) => {
    const currentUser = currentSession?.user || null;
    const currentUserId = currentUser?.id || null;
    const currentToken = currentSession?.access_token || null;

    const isSameUser = currentUserId === lastUserIdRef.current;
    const isSameToken = currentToken === lastTokenRef.current;

    // Se o token e usuário são idênticos, não recria estado nem engatilha re-render
    if (isSameUser && isSameToken) {
      setLoading(false);
      return;
    }

    lastTokenRef.current = currentToken;
    setSession(currentSession);

    if (!isSameUser) {
      lastUserIdRef.current = currentUserId;
      setUser(currentUser);

      if (currentUserId) {
        try {
          const status = await checkProfileCompletion(currentUserId);
          profileStatusRef.current = status;
          setProfileStatus(status);
        } catch (e) {
          console.error('Erro ao verificar status do perfil:', e);
        }
      } else {
        profileStatusRef.current = null;
        setProfileStatus(null);
      }
    } else {
      // Se apenas o token foi renovado (ex: window focus ou visibility change do Supabase),
      // preservamos a referência do usuário para NÃO engatilhar hooks dependentes de user
      if (!profileStatusRef.current && currentUserId) {
        try {
          const status = await checkProfileCompletion(currentUserId);
          profileStatusRef.current = status;
          setProfileStatus(status);
        } catch (e) {
          console.error('Erro ao checar status do perfil em segundo plano:', e);
        }
      }
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
    lastUserIdRef.current = null;
    lastTokenRef.current = null;
    profileStatusRef.current = null;
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
    isLoading: loading,
    profileStatus,
    sendMagicLink,
    signOut,
    refreshSession,
  };
}

export default useAuth;
