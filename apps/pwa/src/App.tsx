/**
 * @file App.tsx
 * @description Aplicação principal do PWA deLIVREry.
 * Orquestra o fluxo de autenticação passwordless (Story 1.2), complementação de perfil universal (Story 1.3)
 * e o Termômetro de Desbloqueio Regional com Indicação Viral (Story 1.4).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/use-auth.ts';
import { MagicLinkForm } from './components/auth/MagicLinkForm.tsx';
import { AuthCallback } from './components/auth/AuthCallback.tsx';
import { ProfileCompletionForm } from './components/profile/ProfileCompletionForm.tsx';
import { ProfileService, UserProfileResponse } from './profile/profile-service.ts';
import { QuorumService, RegionQuorum } from './quorum/quorum-service.ts';
import { ReferralService } from './referral/referral-service.ts';
import { RegionalQuorumThermometer } from './components/quorum/RegionalQuorumThermometer.tsx';
import { ReferralCard } from './components/referral/ReferralCard.tsx';
import { JobPublishModal } from './components/jobs/JobPublishModal.tsx';
import { JobFeed } from './components/jobs/JobFeed.tsx';
import { StoreJobsList } from './components/jobs/StoreJobsList.tsx';
import { RegionalPricingWidget } from './components/pricing/RegionalPricingWidget.tsx';
import { DonationBottomSheet } from './components/donations/DonationBottomSheet.tsx';
import { TransparencyPanel } from './components/donations/TransparencyPanel.tsx';
import { DeveloperPortal } from './components/developers/DeveloperPortal.tsx';
import type { DonationTriggerMoment } from './donations/types.ts';

export const App: React.FC = () => {
  const { user, session, isLoading: isAuthLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [regionQuorum, setRegionQuorum] = useState<RegionQuorum | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobsRefreshTrigger, setJobsRefreshTrigger] = useState(0);
  const [transparencyRefreshTrigger, setTransparencyRefreshTrigger] = useState(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'app' | 'developers'>('app');
  const [donationModalState, setDonationModalState] = useState<{
    isOpen: boolean;
    triggerMoment: DonationTriggerMoment;
  }>({ isOpen: false, triggerMoment: 'manual_donation' });

  // Rastreia código de indicação ou rota /developers vindo pela URL
  useEffect(() => {
    const urlRef = ReferralService.extractReferralCodeFromUrl();
    if (urlRef) {
      ReferralService.saveReferralCodeToStorage(urlRef);
    }
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/developers' || window.location.hash.includes('developers')) {
        setCurrentView('developers');
      }
    }
  }, []);

  // Verifica se está na rota de callback de autenticação (#access_token=...)
  const isAuthCallback =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') || window.location.search.includes('code'));

  // Carrega perfil e quórum regional do usuário
  useEffect(() => {
    async function loadUserProfileAndQuorum() {
      if (!user) {
        setProfileData(null);
        setRegionQuorum(null);
        return;
      }

      setIsProfileLoading(true);
      try {
        const data = await ProfileService.getUserProfile(user.id);
        setProfileData(data);

        // Se o perfil tiver localização, busca o quórum regional
        if (data && data.profile) {
          const stateId = data.profile.state_id;
          const cityId = data.profile.city_id;
          const neighborhoodId =
            data.profile.home_neighborhood_id || data.profile.neighborhood_id;

          if (stateId && cityId && neighborhoodId) {
            const quorum = await QuorumService.getRegionQuorum(
              stateId,
              cityId,
              neighborhoodId
            );
            setRegionQuorum(quorum);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar perfil ou quórum do usuário:', err);
      } finally {
        setIsProfileLoading(false);
      }
    }

    loadUserProfileAndQuorum();
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

  // Se a visão ativa for o Portal do Desenvolvedor (Story 5.4)
  if (currentView === 'developers') {
    return <DeveloperPortal onBack={() => setCurrentView('app')} />;
  }

  // Usuário não autenticado -> Tela de Magic Link (Story 1.2) + Painel Público de Transparência (Story 4.4 - FR-12)
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
          padding: '24px 16px'
        }}
      >
        <div style={{ maxWidth: '460px', width: '100%' }}>
          <MagicLinkForm />

          {/* Acesso ao Portal do Desenvolvedor para Visitantes e Integradores */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setCurrentView('developers')}
              data-testid="visitor-btn-developers"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#38bdf8',
                padding: '10px 16px',
                minHeight: '48px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚡</span>
              <span>Integrador ou Desenvolvedor? Acesse a API e Webhooks</span>
            </button>
          </div>

          {/* Painel Público de Transparência de Custos (Story 4.4) */}
          <TransparencyPanel
            refreshTrigger={transparencyRefreshTrigger}
            onOpenDonationModal={(moment) =>
              setDonationModalState({ isOpen: true, triggerMoment: moment })
            }
          />
        </div>

        {/* Modal de Doação Voluntária PIX para Visitantes */}
        <DonationBottomSheet
          isOpen={donationModalState.isOpen}
          onClose={() => setDonationModalState((prev) => ({ ...prev, isOpen: false }))}
          triggerMoment={donationModalState.triggerMoment}
          onDonated={async ({ amount }) => {
            setTransparencyRefreshTrigger((prev) => prev + 1);
            setSuccessToast(`💚 Muito obrigado pelo apoio comunitário de R$ ${amount.toFixed(2).replace('.', ',')}!`);
            setTimeout(() => setSuccessToast(null), 4500);
          }}
        />

        {/* Toast de Confirmação */}
        {successToast && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#10b981',
              color: '#0f172a',
              padding: '12px 24px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)',
              zIndex: 1100
            }}
          >
            {successToast}
          </div>
        )}
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

  const neighborhoodName =
    profileData.profile?.home_neighborhood_id ||
    profileData.profile?.neighborhood_id ||
    'Bairro';

  const referralCode =
    profileData.profile?.referral_code ||
    `LOJA-${profileData.user.id.slice(0, 6).toUpperCase()}`;

  // Perfil Ativo -> Dashboard Inicial com Quórum e Indicação Viral (Story 1.4)
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
          maxWidth: '640px',
          margin: '0 auto'
        }}
      >
        {/* Barra Superior do Usuário */}
        <div
          style={{
            backgroundColor: '#131822',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #1e293b',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor:
                    profileData.user.userType === 'courier' ? '#0369a1' : '#047857',
                  color: '#fff'
                }}
              >
                {profileData.user.userType === 'courier'
                  ? '🛵 Entregador Ativo'
                  : '🏪 Lojista Ativo'}
              </span>

              {/* Selo de Apoiador da Comunidade (Story 4.3) */}
              {Boolean(profileData.profile?.community_supporter) && (
                <span
                  data-testid="badge-community-supporter"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#064e3b',
                    color: '#34d399',
                    border: '1px solid #059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>💚</span>
                  <span>Apoiador da Comunidade</span>
                </span>
              )}

              {/* Badge de Nível e XP */}
              {profileData.profile?.level && (
                <span
                  data-testid="badge-user-level"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#3b0764',
                    color: '#d8b4fe',
                    border: '1px solid #7e22ce'
                  }}
                >
                  ⭐ Nível {profileData.profile.level} ({profileData.profile.xp_points || 0} XP)
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '20px', margin: '8px 0 2px 0' }}>
              Olá, {profileData.user.fullName}!
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
              {profileData.user.email} • CPF: {profileData.user.cpf}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setDonationModalState({ isOpen: true, triggerMoment: 'manual_donation' })}
              data-testid="header-btn-donate"
              style={{
                minHeight: '48px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#064e3b',
                border: '1px solid #059669',
                color: '#34d399',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>💚</span>
              <span>Apoiar</span>
            </button>

            <button
              onClick={() => setCurrentView('developers')}
              data-testid="header-btn-developers"
              style={{
                minHeight: '48px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>⚡</span>
              <span>API / Devs</span>
            </button>

            <button
              onClick={() => signOut()}
              style={{
                minHeight: '48px',
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
        </div>

        {/* Termômetro de Desbloqueio Regional (FR-13) */}
        {regionQuorum && (
          <RegionalQuorumThermometer
            quorum={regionQuorum}
            neighborhoodName={neighborhoodName}
            cityName={profileData.profile?.city_id}
            stateId={profileData.profile?.state_id}
            onShareClick={() => {
              ReferralService.shareReferral(referralCode, neighborhoodName);
            }}
          />
        )}

        {/* Card de Indicação Viral Multicanal (FR-15) */}
        <ReferralCard
          referralCode={referralCode}
          neighborhoodName={neighborhoodName}
        />

        {/* Balizador Inteligente de Preços Regionais (Story 3.4) */}
        <div style={{ marginBottom: '16px' }}>
          <RegionalPricingWidget
            stateId={profileData.profile?.state_id || 'RJ'}
            cityId={profileData.profile?.city_id || 'rio-de-janeiro'}
            neighborhoodId={profileData.profile?.home_neighborhood_id || profileData.profile?.neighborhood_id || 'copacabana'}
            initialModal={profileData.profile?.transport_modal || 'all'}
            title="📊 Balizador de Preços da sua Região"
          />
        </div>

        {/* Detalhes do Perfil e Modal */}
        <div
          style={{
            backgroundColor: '#131822',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #1e293b'
          }}
        >
          {profileData.user.userType === 'courier' ? (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px'
                }}
              >
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
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b' }}
                  >
                    {profileData.profile?.level || 'Bronze'} (0 XP)
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Diária Base</div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}
                  >
                    R$ {Number(profileData.profile?.base_daily_rate || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Taxa por Entrega
                  </div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}
                  >
                    R$ {Number(profileData.profile?.base_delivery_fee || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Estabelecimento Comercial
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                  {profileData.profile?.store_name}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Reputação Inicial
                  </div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#eab308' }}
                  >
                    ⭐ {Number(profileData.profile?.reputation_score || 5).toFixed(2)} / 5.00
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Gamificação / Nível
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b' }}>
                    ⭐ {profileData.profile?.level || 'Bronze'} ({profileData.profile?.xp_points || 0} XP)
                  </div>
                </div>
              </div>

              {/* Botão de Ação Primária: Publicar Vaga de Turno */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsJobModalOpen(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.35)'
                  }}
                >
                  ➕ Publicar Nova Vaga de Turno
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feed de Vagas para Entregadores (Story 2.3) */}
        {profileData.user.userType === 'courier' && (
          <JobFeed
            courierUserId={user.id}
            transportModal={profileData.profile?.transport_modal || 'motorcycle'}
            stateId={profileData.profile?.state_id || 'SP'}
            cityId={profileData.profile?.city_id || 'sao-paulo'}
            neighborhoodId={profileData.profile?.home_neighborhood_id || 'centro'}
          />
        )}

        {/* Gestão de Vagas e Matchings para Lojistas (Story 2.4) */}
        {profileData.user.userType === 'store' && (
          <StoreJobsList
            storeUserId={user.id}
            refreshTrigger={jobsRefreshTrigger}
          />
        )}

        {/* Painel Público de Transparência de Custos do Servidor e Vitória Coletiva (Story 4.4 - FR-12) */}
        <TransparencyPanel
          refreshTrigger={transparencyRefreshTrigger}
          onOpenDonationModal={(moment) =>
            setDonationModalState({ isOpen: true, triggerMoment: moment })
          }
        />

        {/* Toast de Sucesso */}
        {successToast && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#10b981',
              color: '#0f172a',
              padding: '12px 24px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)',
              zIndex: 1100
            }}
          >
            {successToast}
          </div>
        )}

        {/* Modal de Publicação de Vagas (Story 2.2) */}
        {profileData?.user.userType === 'store' && (
          <JobPublishModal
            isOpen={isJobModalOpen}
            onClose={() => setIsJobModalOpen(false)}
            storeUserId={user?.id || ''}
            storeName={profileData.profile?.store_name || 'Estabelecimento'}
            defaultStateId={profileData.profile?.state_id || 'SP'}
            defaultCityId={profileData.profile?.city_id || 'sao-paulo'}
            defaultNeighborhoodId={profileData.profile?.neighborhood_id || 'centro'}
            onSuccess={(_job, earnedXp) => {
              setJobsRefreshTrigger((prev) => prev + 1);
              const msg = earnedXp
                ? '🎉 Vaga publicada com sucesso! +50 XP acumulados por antecipação!'
                : '✅ Vaga publicada com sucesso!';
              setSuccessToast(msg);
              setTimeout(() => setSuccessToast(null), 4000);
            }}
          />
        )}

        {/* Bottom Sheet de Microdoação PIX (Story 4.2 - FR-10, FR-11) */}
        <DonationBottomSheet
          isOpen={donationModalState.isOpen}
          onClose={() => setDonationModalState((prev) => ({ ...prev, isOpen: false }))}
          triggerMoment={donationModalState.triggerMoment}
          currentUserId={user?.id}
          onDonated={async ({ amount }) => {
            setTransparencyRefreshTrigger((prev) => prev + 1);
            if (user?.id) {
              try {
                const refreshed = await ProfileService.getUserProfile(user.id);
                if (refreshed) {
                  setProfileData(refreshed);
                }
              } catch {
                // Fallback silencioso
              }
            }
            setSuccessToast(`💚 Muito obrigado pelo apoio comunitário de R$ ${amount.toFixed(2).replace('.', ',')}!`);
            setTimeout(() => setSuccessToast(null), 4500);
          }}
        />
      </div>
    </div>
  );
};
