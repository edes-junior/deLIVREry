/**
 * @file App.tsx
 * @description Aplicação principal do PWA deLIVREry.
 * Orquestra o fluxo de autenticação passwordless (Story 1.2) e complementação de perfil universal (Story 1.3).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/use-auth.ts';
import { MagicLinkForm } from './components/auth/MagicLinkForm.tsx';
import { AuthCallback } from './components/auth/AuthCallback.tsx';
import { ProfileCompletionForm } from './components/profile/ProfileCompletionForm.tsx';
import { ProfileService, UserProfileResponse } from './profile/profile-service.ts';

export const App: React.FC = () => {
  const { user, session, isLoading: isAuthLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Verifica se está na rota de callback de autenticação (#access_token=...)
  const isAuthCallback = typeof window !== 'undefined' && 
    (window.location.hash.includes('access_token') || window.location.search.includes('code'));

  useEffect(() => {
    async function loadUserProfile() {
      if (!user) {
        setProfileData(null);
        return;
      }

      setIsProfileLoading(true);
      try {
        const data = await ProfileService.getUserProfile(user.id);
        setProfileData(data);
      } catch (err) {
        console.error('Erro ao carregar perfil do usuário:', err);
      } finally {
        setIsProfileLoading(false);
      }
    }

    loadUserProfile();
  }, [user]);

  if (isAuthCallback) {
    return (
      <AuthCallback
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.location.hash = '';
          }
        }}
      />
    );
  }

  if (isAuthLoading || isProfileLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          color: '#94a3b8',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #1e293b',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto'
            }}
          />
          <p>Carregando deLIVREry...</p>
        </div>
      </div>
    );
  }

  // Usuário não autenticado -> Tela de Magic Link (Story 1.2)
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}
      >
        <MagicLinkForm />
      </div>
    );
  }

  // Usuário autenticado, mas perfil ainda incompleto -> Form de Perfil (Story 1.3)
  const isProfileComplete = profileData && profileData.user && profileData.user.userType;

  if (!isProfileComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          padding: '24px 16px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <ProfileCompletionForm
          userId={user.id}
          userEmail={user.email || ''}
          onProfileCompleted={(completedProfile) => {
            setProfileData(completedProfile);
          }}
        />
      </div>
    );
  }

  // Perfil Ativo -> Dashboard Inicial
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px 16px'
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#131822',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #1e293b'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: profileData.user.userType === 'courier' ? '#0369a1' : '#047857',
                color: '#fff'
              }}
            >
              {profileData.user.userType === 'courier' ? '🛵 Entregador Ativo' : '🏪 Lojista Ativo'}
            </span>
            <h1 style={{ fontSize: '22px', margin: '8px 0 2px 0' }}>
              Olá, {profileData.user.fullName}!
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
              {profileData.user.email} • CPF: {profileData.user.cpf}
            </p>
          </div>

          <button
            onClick={() => signOut()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Sair
          </button>
        </div>

        {/* Detalhes do Perfil */}
        <div
          style={{
            backgroundColor: '#0f172a',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            border: '1px solid #1e293b'
          }}
        >
          {profileData.user.userType === 'courier' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Modal</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {profileData.profile?.transport_modal === 'motorcycle'
                      ? '🏍️ Motocicleta'
                      : profileData.profile?.transport_modal === 'bicycle'
                      ? '🚲 Bicicleta'
                      : '⚡ E-Bike'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nível / XP</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b' }}>
                    {profileData.profile?.level || 'Bronze'} (0 XP)
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Diária Base</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}>
                    R$ {Number(profileData.profile?.base_daily_rate || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Taxa por Entrega</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}>
                    R$ {Number(profileData.profile?.base_delivery_fee || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
                    Seu Código de Indicação Viral:
                  </span>
                  <strong style={{ fontSize: '16px', color: '#38bdf8', letterSpacing: '1px' }}>
                    {profileData.profile?.referral_code}
                  </strong>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profileData.profile?.referral_code || '');
                    alert('Código copiado para a área de transferência!');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#38bdf8',
                    color: '#0f172a',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Copiar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Estabelecimento</div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                  {profileData.profile?.store_name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Reputação Inicial</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#eab308' }}>
                    ⭐ {Number(profileData.profile?.reputation_score || 5).toFixed(2)} / 5.00
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Região</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {profileData.profile?.neighborhood_id}, {profileData.profile?.city_id} - {profileData.profile?.state_id}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
