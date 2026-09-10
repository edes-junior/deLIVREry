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
import { ProfileEditModal } from './components/profile/ProfileEditModal.tsx';
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
import { BottomNav, NavTab } from './components/ui/BottomNav.tsx';
import { Card } from './components/ui/Card.tsx';
import { Badge } from './components/ui/Badge.tsx';
import { Button } from './components/ui/Button.tsx';
import { Logo } from './components/ui/Logo.tsx';
import { Avatar } from './components/ui/Avatar.tsx';
import type { DonationTriggerMoment } from './donations/types.ts';
import {
  MapPin,
  Heart,
  Terminal,
  LogOut,
  Bike,
  Star,
  Settings,
  Radio,
  PauseCircle,
  Zap,
  Plus
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<NavTab>('turnos');
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [donationModalState, setDonationModalState] = useState<{
    isOpen: boolean;
    triggerMoment: DonationTriggerMoment;
  }>({ isOpen: false, triggerMoment: 'manual_donation' });

  const isCourier = profileData?.user?.userType === 'courier';
  const isCourierActive = profileData?.profile?.is_active !== false;

  const handleToggleCourierAvailability = async () => {
    if (!user || !isCourier || isTogglingAvailability) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 30]);
    }
    setIsTogglingAvailability(true);
    try {
      const nextState = !isCourierActive;
      const res = await ProfileService.toggleCourierAvailability(user.id, nextState);
      if (res.success) {
        setProfileData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              is_active: res.isActive
            }
          };
        });
        setSuccessToast(
          res.isActive
            ? 'Você está online e disponível para receber vagas!'
            : 'Modo pausado ativo. Alertas de novas vagas foram suspensos.'
        );
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao alternar disponibilidade:', err);
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleProfileUpdated = async (updated: UserProfileResponse) => {
    setProfileData(updated);
    setSuccessToast('Dados do perfil atualizados com sucesso!');
    setTimeout(() => setSuccessToast(null), 4500);

    if (updated && updated.profile) {
      const stateId = updated.profile.state_id;
      const cityId = updated.profile.city_id;
      const neighborhoodId =
        updated.profile.home_neighborhood_id || updated.profile.neighborhood_id;

      if (stateId && cityId && neighborhoodId) {
        try {
          const quorum = await QuorumService.getRegionQuorum(stateId, cityId, neighborhoodId);
          setRegionQuorum(quorum);
        } catch (err) {
          console.error('Erro ao recarregar quórum:', err);
        }
      }
    }
  };

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
  const userId = user?.id;

  useEffect(() => {
    async function loadUserProfileAndQuorum() {
      if (!userId) {
        setProfileData(null);
        setRegionQuorum(null);
        return;
      }

      // Só ativa isProfileLoading se ainda não tivermos nenhum dado em memória
      if (!profileData) {
        setIsProfileLoading(true);
      }
      try {
        const data = await ProfileService.getUserProfile(userId);
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
  }, [userId]);

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

  // Estado de Carregamento Inicial (Splash Screen de Abertura)
  // CRÍTICO: Só exibe Splash Screen se profileData AINDA for nulo no carregamento inicial!
  // Revalidações em segundo plano (como ao alternar de abas ou focar a janela) mantêm a árvore React
  // montada, preservando dados de formulários e modais abertos.
  if (!profileData && (isAuthLoading || isProfileLoading)) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#06090E',
          color: '#94a3b8',
          padding: '24px 16px',
          textAlign: 'center'
        }}
        data-testid="delivrery-splash-screen"
      >
        <div style={{ marginBottom: '24px' }}>
          <Logo variant="emblem" size="lg" />
        </div>
        <div
          style={{
            width: '140px',
            height: '4px',
            backgroundColor: '#141B29',
            borderRadius: '999px',
            overflow: 'hidden',
            margin: '0 auto 12px auto'
          }}
        >
          <div
            style={{
              width: '70%',
              height: '100%',
              backgroundColor: 'var(--neon-emerald, #00F59B)',
              borderRadius: '999px',
              boxShadow: '0 0 10px var(--neon-emerald, #00F59B)'
            }}
          />
        </div>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: '#64748B', textTransform: 'uppercase' }}>
          Inicializando rede segura...
        </p>
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
          backgroundColor: '#06090E',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '32px 16px'
        }}
      >
        <div style={{ maxWidth: '440px', width: '100%' }}>
          {/* Logo Hero Oficial no topo da tela inicial */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }} data-testid="landing-hero-logo">
            <Logo variant="emblem" size="lg" />
          </div>

          <MagicLinkForm />

          {/* Acesso ao Portal do Desenvolvedor para Visitantes e Integradores */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setCurrentView('developers')}
              data-testid="visitor-btn-developers"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                textDecoration: 'underline',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Zap size={14} />
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
            setSuccessToast(`Muito obrigado pelo apoio comunitário de R$ ${amount.toFixed(2).replace('.', ',')}!`);
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

  const operatingCount = profileData.profile?.operating_neighborhoods?.length || 0;
  const neighborhoodBadgeLabel = isCourier && operatingCount > 1
    ? `${neighborhoodName} +${operatingCount - 1}`
    : neighborhoodName;

  const referralCode =
    profileData.profile?.referral_code ||
    `LOJA-${profileData.user.id.slice(0, 6).toUpperCase()}`;

  // Perfil Ativo -> Dashboard Inicial com Quórum e Indicação Viral (Story 1.4)
  return (
    <div className="app-container">
      {/* Barra Superior / Header Tático (320px-proof) */}
      <header className="tactical-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <Logo variant="horizontal" size="sm" showTagline={false} className="mobile-only" />
          <Logo variant="horizontal" size="sm" showTagline={true} className="desktop-only" />

          {neighborhoodBadgeLabel && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--neon-emerald)',
                  boxShadow: '0 0 6px var(--neon-emerald)',
                  flexShrink: 0
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{neighborhoodBadgeLabel}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => setDonationModalState({ isOpen: true, triggerMoment: 'manual_donation' })}
            data-testid="header-btn-donate"
            className="desktop-only"
            style={{
              minHeight: '40px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 245, 155, 0.12)',
              border: '1px solid var(--neon-emerald)',
              color: 'var(--neon-emerald)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Heart size={14} />
            <span>Apoiar</span>
          </button>

          <button
            onClick={() => setCurrentView('developers')}
            data-testid="header-btn-developers"
            className="desktop-only"
            style={{
              minHeight: '40px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Terminal size={14} />
            <span>API / Devs</span>
          </button>

          <button
            onClick={() => signOut()}
            style={{
              minHeight: '32px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Encerrar sessão"
          >
            <LogOut size={12} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Cockpit Operacional Unificado (320px-first) */}
      <Card variant="default" padding="sm" className="profile-hud-card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {/* Nível 1: Identificação Limpa + Acesso a Configurações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <Avatar
                src={profileData.user.avatarUrl}
                name={profileData.user.fullName}
                userType={profileData.user.userType}
                size="sm"
                showBadge={true}
                alt={profileData.user.fullName}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <h1
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  Olá, {profileData.user.fullName}!
                </h1>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Bike size={12} />
                    {profileData.user.userType === 'courier' ? 'Entregador' : 'Lojista'}
                  </span>
                  {profileData.profile?.level && (
                    <span
                      data-testid="badge-user-level"
                      style={{
                        color: 'var(--highvis-yellow)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      • <Star size={11} fill="currentColor" /> Nível {profileData.profile.level} ({profileData.profile.xp_points || 0} XP)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditProfileModalOpen(true)}
              data-testid="btn-edit-profile"
              style={{
                minHeight: '34px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-raised, #141b29)',
                border: '1px solid var(--border-subtle, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
              title="Editar Perfil"
            >
              <Settings size={14} />
              <span className="desktop-only">Perfil</span>
            </button>
          </div>

          {/* Nível 2: Botão de Disponibilidade Tático Full-Width (Polegar-Friendly na Moto) */}
          {isCourier && (
            <button
              type="button"
              onClick={handleToggleCourierAvailability}
              disabled={isTogglingAvailability}
              data-testid="btn-toggle-availability"
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isCourierActive ? 'rgba(0, 245, 155, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: isCourierActive ? '1px solid var(--neon-emerald)' : '1px solid #ef4444',
                color: isCourierActive ? 'var(--neon-emerald)' : '#ef4444',
                cursor: isTogglingAvailability ? 'wait' : 'pointer',
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: isCourierActive ? '0 0 14px rgba(0, 245, 155, 0.15)' : 'none'
              }}
              title={isCourierActive ? 'Toque para pausar recebimento de propostas' : 'Toque para ficar online e receber vagas'}
            >
              {isCourierActive ? (
                <Radio size={16} className="animate-pulse" style={{ flexShrink: 0 }} />
              ) : (
                <PauseCircle size={16} style={{ flexShrink: 0 }} />
              )}
              <span>{isCourierActive ? 'ONLINE • RECEBENDO VAGAS' : 'PAUSADO • TOQUE P/ FICAR ONLINE'}</span>
            </button>
          )}

          {/* Nível 3: Faixa Operacional de Apoio (Diária Base + Modal Integrados) */}
          {isCourier && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}
            >
              <div>
                Diária Base:{' '}
                <strong className="tabular-price" style={{ color: 'var(--neon-emerald)', fontSize: '12px' }}>
                  R$ {Number(profileData.profile?.base_daily_rate || 0).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Bike size={13} style={{ color: 'var(--text-secondary)' }} />
                <span>Modal:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {profileData.profile?.transport_modal === 'motorcycle'
                    ? 'Moto'
                    : profileData.profile?.transport_modal === 'bicycle'
                    ? 'Bike'
                    : 'E-Bike'}
                </strong>
              </div>
            </div>
          )}

          <p className="desktop-only" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px' }}>
            {profileData.user.email} • CPF: {profileData.user.cpf}
          </p>
        </div>
      </Card>

      {/* Grid Responsivo de 2 Colunas no Desktop / 1 Coluna no Mobile */}
      <div className="grid-responsive">
        {/* COLUNA PRINCIPAL: Feed de Vagas ou Painel de Turnos do Lojista */}
        <div className={`col-main mobile-tab-content ${activeTab === 'turnos' ? 'is-active' : ''}`}>
          {profileData.user.userType === 'courier' ? (
            <>
              {!isCourierActive && (
                <div
                  data-testid="courier-paused-banner"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <PauseCircle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#fca5a5' }}>
                        Disponibilidade Operacional em Pausa
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                        Notificações de novas oportunidades e chamadas foram suspensas até sua reativação.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCourierAvailability}
                    style={{
                      minHeight: '38px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--neon-emerald)',
                      color: '#06090e',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0, 245, 155, 0.3)'
                    }}
                  >
                    <Radio size={14} />
                    <span>Ficar Online Agora</span>
                  </button>
                </div>
              )}

              <JobFeed
                courierUserId={user.id}
                transportModal={profileData.profile?.transport_modal || 'motorcycle'}
                stateId={profileData.profile?.state_id || 'SP'}
                cityId={profileData.profile?.city_id || 'sao-paulo'}
                neighborhoodId={profileData.profile?.home_neighborhood_id || 'centro'}
                operatingNeighborhoods={profileData.profile?.operating_neighborhoods || []}
              />
            </>
          ) : (
            <>
              {/* Ação Primária Lojista: Publicar Nova Vaga */}
              <Card variant="raised" style={{ textAlign: 'center', padding: '18px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Precisa de Entregadores para o seu Turno?
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Publique a vaga com mais de 48h de antecedência para acumular +50 XP.
                </p>
                <Button
                  variant="cta"
                  onClick={() => setIsJobModalOpen(true)}
                  style={{ width: '100%', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Plus size={16} />
                  <span>Publicar Nova Vaga de Turno</span>
                </Button>
              </Card>

              <StoreJobsList
                storeUserId={user.id}
                refreshTrigger={jobsRefreshTrigger}
              />
            </>
          )}
        </div>

        {/* COLUNA LATERAL: Métricas Regionais, Meta do Bairro e Indicação */}
        <div className="col-sidebar">
          {/* Resumo da Modalidade / Diária Base */}
          <Card
            variant="default"
            className={`mobile-tab-content ${activeTab === 'precos' ? 'is-active' : ''}`}
          >
            {profileData.user.userType === 'courier' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Modal</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {profileData.profile?.transport_modal === 'motorcycle' ? (
                      <>
                        <Bike size={14} />
                        <span>Motocicleta</span>
                      </>
                    ) : profileData.profile?.transport_modal === 'bicycle' ? (
                      <>
                        <Bike size={14} />
                        <span>Bicicleta</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>E-Bike</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Sua Diária Base</div>
                  <div className="tabular-price" style={{ fontSize: '15px', color: 'var(--neon-emerald)' }}>
                    R$ {Number(profileData.profile?.base_daily_rate || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estabelecimento</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {profileData.profile?.store_name}
                </div>
              </div>
            )}
          </Card>

          {/* Balizador de Preços da Região */}
          <div className={`mobile-tab-content ${activeTab === 'precos' ? 'is-active' : ''}`} style={{ width: '100%' }}>
            <RegionalPricingWidget
              stateId={profileData.profile?.state_id || 'RJ'}
              cityId={profileData.profile?.city_id || 'rio-de-janeiro'}
              neighborhoodId={profileData.profile?.home_neighborhood_id || profileData.profile?.neighborhood_id || 'copacabana'}
              initialModal={profileData.profile?.transport_modal || 'all'}
              title="Balizador de Preços da sua Região"
            />
          </div>

          {/* Termômetro de Meta do Bairro */}
          <div className={`mobile-tab-content ${activeTab === 'quorum' ? 'is-active' : ''}`} style={{ width: '100%' }}>
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
          </div>

          {/* Indicação Viral */}
          <div className={`mobile-tab-content ${activeTab === 'quorum' ? 'is-active' : ''}`} style={{ width: '100%' }}>
            <ReferralCard
              referralCode={referralCode}
              neighborhoodName={neighborhoodName}
            />
          </div>

          {/* Painel Público de Transparência de Custos */}
          <div className={`mobile-tab-content ${activeTab === 'doar' ? 'is-active' : ''}`} style={{ width: '100%' }}>
            <TransparencyPanel
              refreshTrigger={transparencyRefreshTrigger}
              onOpenDonationModal={(moment) =>
                setDonationModalState({ isOpen: true, triggerMoment: moment })
              }
            />
          </div>
        </div>
      </div>

      {/* Navegação Inferior Fixa para Mobile */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'doar') {
            setDonationModalState({ isOpen: true, triggerMoment: 'manual_donation' });
          }
        }}
      />

      {/* Toast de Sucesso */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--neon-emerald)',
            color: 'var(--bg-base)',
            padding: '12px 24px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 800,
            fontSize: '14px',
            boxShadow: '0 10px 25px -5px rgba(0, 245, 155, 0.4)',
            zIndex: 1100,
            whiteSpace: 'nowrap'
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
              ? 'Vaga publicada com sucesso! +50 XP acumulados por antecipação!'
              : 'Vaga publicada com sucesso!';
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
          setSuccessToast(`Muito obrigado pelo apoio comunitário de R$ ${amount.toFixed(2).replace('.', ',')}!`);
          setTimeout(() => setSuccessToast(null), 4500);
        }}
      />

      {/* Modal de Edição de Perfil (Story 1 / CAP-1 / CAP-6) */}
      {isEditProfileModalOpen && profileData && (
        <ProfileEditModal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          profileData={profileData}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
};
