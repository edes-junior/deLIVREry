import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { checkProfileCompletion } from '../../auth/auth-service.ts';

interface AuthCallbackProps {
  onNavigate?: (route: string) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ onNavigate }) => {
  const [statusText, setStatusText] = useState('Verificando link de acesso...');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function processAuth() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (active) setErrorText(sessionError.message);
          return;
        }

        const currentSession = sessionData?.session;
        if (!currentSession) {
          // Aguarda breve intervalo caso os tokens do hash da URL ainda estejam sendo parseados
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession) {
              await handleRedirect(newSession.user.id);
            }
          });

          setTimeout(() => {
            if (active && !currentSession) {
              setErrorText('Link de autenticação expirado ou inválido. Solicite um novo link.');
            }
          }, 3000);
          return;
        }

        await handleRedirect(currentSession.user.id);
      } catch (err: any) {
        if (active) setErrorText(err?.message || 'Falha ao processar autenticação.');
      }
    }

    async function handleRedirect(userId: string) {
      if (!active) return;
      setStatusText('Sessão estabelecida! Verificando cadastro...');

      const profileStatus = await checkProfileCompletion(userId);
      const targetRoute = profileStatus.needsProfileCompletion
        ? '/completar-cadastro'
        : '/dashboard';

      if (onNavigate) {
        onNavigate(targetRoute);
      } else if (typeof window !== 'undefined') {
        window.location.href = targetRoute;
      }
    }

    processAuth();

    return () => {
      active = false;
    };
  }, [onNavigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {errorText ? (
        <div style={{ color: '#991b1b', backgroundColor: '#fef2f2', padding: '20px', borderRadius: '12px', border: '1px solid #fecaca', maxWidth: '400px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Erro de Autenticação</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>{errorText}</p>
          <a
            href="/"
            style={{ display: 'inline-block', marginTop: '16px', color: '#10b981', fontWeight: 600, textDecoration: 'underline' }}
          >
            Voltar para a página inicial
          </a>
        </div>
      ) : (
        <div>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#10b981',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto',
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#374151', fontSize: '15px', fontWeight: 500 }}>{statusText}</p>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;
