/**
 * @file e2e-integrated-journey.test.js
 * @description Suíte de Testes Automatizados E2E / Integrados de Ponta a Ponta para o deLIVREry.
 * Abrange o ciclo completo dos 5 Épicos:
 * 1. Onboarding & Autenticação Passwordless (Magic Link, Geografia e Quórum)
 * 2. Publicação de Vagas com Antecedência, Notificações Web Push e Matching Bid/Ask
 * 3. Trava de Velocidade Tarifária e Proteção Anti-Manipulação
 * 4. Delight Moments de Microdoação PIX, Badge de Apoiador e Painel de Transparência
 * 5. Plataforma Headless, Webhooks Assinados HMAC-SHA256 e Web Component delivrery-button
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// --- Importações de Módulos da Aplicação ---
import { validateEmail, sendMagicLink } from '../apps/pwa/src/auth/auth-service.ts';
import { validateCPF, validatePhone } from '../apps/pwa/src/profile/cpf-validator.ts';
import { GeographyService, slugify } from '../apps/pwa/src/geography/geography-service.ts';
import { generateReferralCode, validateRateVelocity } from '../apps/pwa/src/profile/profile-service.ts';
import { calculateQuorumMetrics } from '../apps/pwa/src/quorum/quorum-service.ts';
import { ReferralService } from '../apps/pwa/src/referral/referral-service.ts';
import {
  createJobPost,
  listOpenJobs,
  submitBid,
  acceptBid,
  completeJob,
  submitJobRating,
  isJobCompatibleWithModal
} from '../apps/pwa/src/jobs/job-service.ts';
import {
  filterCouriersForJob,
  formatJobPushPayload,
  isEligibleForEarlyXpBonus
} from '../apps/pwa/src/notifications/notification-service.ts';
import { DonationService } from '../apps/pwa/src/donations/donation-service.ts';
import { getPixConfig } from '../apps/pwa/src/donations/pix-config.ts';
import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
import { HeadlessApiRouter } from '../apps/pwa/src/api/headless/headless-api-router.ts';
import { WebhookDispatcherService } from '../apps/pwa/src/api/webhooks/webhook-dispatcher.ts';
import { WebhookCrypto } from '../apps/pwa/src/api/webhooks/webhook-crypto.ts';
import { hashApiKey, verifyWebhookSignature } from '../packages/api-client-sdk/src/index.js';

// --- Mocks para ambiente DOM antes de carregar o Web Component ---
class MockShadowRoot {
  constructor() {
    this.innerHTML = '';
  }
  querySelector(selector) {
    if (this.innerHTML.includes(selector.replace('.', '').replace('#', ''))) {
      const listeners = {};
      return {
        addEventListener: (event, handler) => { listeners[event] = handler; },
        dispatchEvent: (event) => { if (listeners[event.type]) listeners[event.type](event); },
        _listeners: listeners
      };
    }
    return null;
  }
}

class MockCustomElementsRegistry {
  constructor() {
    this.registry = new Map();
  }
  define(name, constructor) {
    this.registry.set(name, constructor);
  }
  get(name) {
    return this.registry.get(name);
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.composed = !!init.composed;
    this.detail = init.detail || {};
  }
}

class MockHTMLElement {
  constructor() {
    this._attributes = new Map();
    this._eventListeners = {};
    this.shadowRoot = null;
  }
  attachShadow(options) {
    this.shadowRoot = new MockShadowRoot();
    this.shadowRootMode = options.mode;
    return this.shadowRoot;
  }
  getAttribute(name) {
    return this._attributes.get(name) || null;
  }
  setAttribute(name, value) {
    const oldValue = this._attributes.get(name) || null;
    this._attributes.set(name, String(value));
    if (typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(name, oldValue, String(value));
    }
  }
  removeAttribute(name) {
    const oldValue = this._attributes.get(name) || null;
    this._attributes.delete(name);
    if (typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(name, oldValue, null);
    }
  }
  addEventListener(event, handler) {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(handler);
  }
  removeEventListener(event, handler) {
    if (this._eventListeners[event]) {
      this._eventListeners[event] = this._eventListeners[event].filter(h => h !== handler);
    }
  }
  dispatchEvent(event) {
    const handlers = this._eventListeners[event.type] || [];
    for (const handler of handlers) {
      handler(event);
    }
    return true;
  }
}

globalThis.HTMLElement = MockHTMLElement;
globalThis.CustomEvent = MockCustomEvent;
globalThis.customElements = new MockCustomElementsRegistry();
if (typeof navigator !== 'undefined') {
  try {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      configurable: true,
      writable: true
    });
  } catch (e) {}
} else {
  globalThis.navigator = { vibrate: () => true };
}
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.window = {
  open: () => {},
  location: { origin: 'https://delivrery.app' }
};

// Importa o Web Component dinamicamente após globals configurados
const { DelivreryButton } = await import('../packages/embed-widget/src/delivrery-button.js');

/**
 * Mock em memória do cliente Supabase para orquestração ponta a ponta
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    users: initialData.users || [],
    courier_profiles: initialData.courier_profiles || [],
    store_profiles: initialData.store_profiles || [],
    job_posts: initialData.job_posts || [],
    job_bids: initialData.job_bids || [],
    job_ratings: initialData.job_ratings || [],
    donations_log: initialData.donations_log || [],
    region_unlocks: initialData.region_unlocks || []
  };

  return {
    storage,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        dataToInsert: null,
        dataToUpdate: null
      };

      const chain = {
        insert(payload) {
          state.dataToInsert = payload;
          return chain;
        },
        update(payload) {
          state.dataToUpdate = payload;
          return chain;
        },
        select() {
          return chain;
        },
        eq(col, val) {
          state.filters.push({ col, val, op: 'eq' });
          return chain;
        },
        neq(col, val) {
          state.filters.push({ col, val, op: 'neq' });
          return chain;
        },
        contains(col, val) {
          state.filters.push({ col, val, op: 'contains' });
          return chain;
        },
        order() {
          return chain;
        },
        async single() {
          if (state.dataToInsert) {
            const row = {
              id: `${state.table}-id-${(storage[state.table] || []).length + 1}`,
              created_at: new Date().toISOString(),
              ...state.dataToInsert
            };
            if (!storage[state.table]) storage[state.table] = [];
            storage[state.table].push(row);
            return { data: row, error: null };
          }

          if (state.dataToUpdate) {
            const found = (storage[state.table] || []).find((r) =>
              state.filters.every((f) => {
                if (f.op === 'neq') return r[f.col] !== f.val;
                if (f.op === 'contains') {
                  const arr = Array.isArray(r[f.col]) ? r[f.col] : [];
                  return f.val.every((v) => arr.includes(v));
                }
                return r[f.col] === f.val;
              })
            );
            if (found) {
              Object.assign(found, state.dataToUpdate);
              return { data: found, error: null };
            }
          }

          const row = (storage[state.table] || []).find((r) =>
            state.filters.every((f) => {
              if (f.op === 'neq') return r[f.col] !== f.val;
              if (f.op === 'contains') {
                const arr = Array.isArray(r[f.col]) ? r[f.col] : [];
                return f.val.every((v) => arr.includes(v));
              }
              return r[f.col] === f.val;
            })
          );
          if (!row) {
            return { data: null, error: { message: 'Not found' } };
          }
          return { data: row, error: null };
        },
        async maybeSingle() {
          const row = (storage[state.table] || []).find((r) =>
            state.filters.every((f) => {
              if (f.op === 'neq') return r[f.col] !== f.val;
              if (f.op === 'contains') {
                const arr = Array.isArray(r[f.col]) ? r[f.col] : [];
                return f.val.every((v) => arr.includes(v));
              }
              return r[f.col] === f.val;
            })
          );
          return { data: row || null, error: null };
        },
        then(resolve) {
          if (state.dataToUpdate) {
            (storage[state.table] || []).forEach((r) => {
              const match = state.filters.every((f) =>
                f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val
              );
              if (match) {
                Object.assign(r, state.dataToUpdate);
              }
            });
            resolve({ data: null, error: null });
            return;
          }

          const results = (storage[state.table] || []).filter((r) =>
            state.filters.every((f) => {
              if (f.op === 'neq') return r[f.col] !== f.val;
              if (f.op === 'contains') {
                const arr = Array.isArray(r[f.col]) ? r[f.col] : [];
                return f.val.every((v) => arr.includes(v));
              }
              return r[f.col] === f.val;
            })
          );
          resolve({ data: results, error: null });
        }
      };

      return chain;
    }
  };
}

describe('E2E Integrated Journey: Ciclo Completo de Ponta a Ponta (Happy Path)', () => {
  let mockSupabase;
  const storeUserId = 'store-user-sao-paulo-1';
  const courierUserId = 'courier-user-sao-paulo-1';
  const competitorCourierId = 'courier-user-sao-paulo-2';
  const partnerApiKey = 'dlv_live_e2e_partner_secret_12345';
  const partnerClientId = 'client-uuid-e2e-partner';
  const partnerWebhookSecret = 'whsec_e2e_integration_test_secret_key';

  beforeEach(() => {
    DonationService.clearInMemoryLogs();
    ApiGatewayService.clearMockClients();
    WebhookDispatcherService.clearMockSubscriptions();
    HeadlessApiRouter.clearMocks();

    mockSupabase = createMockSupabase({
      store_profiles: [
        {
          user_id: storeUserId,
          store_name: 'Pizzaria Napolitana Livre',
          xp_points: 150,
          level: 'Bronze',
          community_supporter: false,
          monthly_donations_count: 0
        }
      ],
      courier_profiles: [
        {
          user_id: courierUserId,
          full_name: 'Carlos Motoboy Silva',
          transport_modal: 'motorcycle',
          xp_points: 200,
          level: 'Bronze',
          community_supporter: false,
          monthly_donations_count: 0
        },
        {
          user_id: competitorCourierId,
          full_name: 'Roberto Bike Santos',
          transport_modal: 'bicycle',
          xp_points: 50,
          level: 'Bronze',
          community_supporter: false,
          monthly_donations_count: 0
        }
      ]
    });
  });

  it('deve executar o fluxo completo da plataforma com sucesso (Onboarding -> Vaga -> Matching -> Doação -> Webhook)', async () => {
    // =========================================================================
    // ETAPA 1: Onboarding e Autenticação Passwordless (Epic 1)
    // =========================================================================
    const storeEmail = 'lojista@pizzarialivre.com.br';
    const courierEmail = 'carlos.motoboy@delivrery.app.br';

    // 1.1 Validação de emails
    assert.strictEqual(validateEmail(storeEmail).valid, true);
    assert.strictEqual(validateEmail(courierEmail).valid, true);

    // 1.2 Disparo de Magic Link
    const mockAuthClient = {
      auth: {
        async signInWithOtp(params) {
          return { error: null };
        }
      }
    };
    const storeAuthResult = await sendMagicLink(storeEmail, 'https://delivrery.app/auth/callback', mockAuthClient);
    assert.strictEqual(storeAuthResult.success, true);

    // 1.3 Validação de CPF e Telefone dos atores
    assert.strictEqual(validateCPF('12345678909'), true);
    assert.strictEqual(validatePhone('11987654321'), true);

    // 1.4 Seleção Geográfica e Quórum Hiperlocal
    const cities = GeographyService.getCitiesByState('SP');
    assert.ok(cities.length > 0, 'Deve listar cidades de SP');
    const neighborhoods = GeographyService.getNeighborhoodsByCity('sao-paulo');
    assert.ok(neighborhoods.some(n => n.id === 'pinheiros'), 'Pinheiros deve constar na base');

    // 1.5 Geração de referral code e link viral
    const referralCode = generateReferralCode();
    assert.match(referralCode, /^LIVRE-[A-Z0-9]{6}$/);
    const viralUrl = ReferralService.generateReferralUrl(referralCode, 'https://delivrery.app');
    assert.ok(viralUrl.includes(`?ref=${referralCode}`));

    // 1.6 Métrica de Quórum
    const quorum = calculateQuorumMetrics(25, 5);
    assert.strictEqual(quorum.isUnlocked, false);
    assert.strictEqual(quorum.status, 'pre_launch');
    assert.strictEqual(quorum.courierPercentage, 50); // 25 de 50
    assert.strictEqual(quorum.storePercentage, 50);   // 5 de 10

    // =========================================================================
    // ETAPA 2: Publicação de Vaga com Antecedência e Web Push (Epic 2)
    // =========================================================================
    // Publicação com 72h de antecedência (deve bonificar +50 XP para o lojista)
    const futureShiftStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const futureShiftEnd = new Date(Date.now() + 77 * 60 * 60 * 1000).toISOString();

    const jobCreationResult = await createJobPost(
      storeUserId,
      {
        shift_start_time: futureShiftStart,
        shift_end_time: futureShiftEnd,
        offered_daily_rate: 130.00,
        offered_delivery_fee: 8.50,
        accepted_modals: ['motorcycle'],
        delivery_radius_km: 4.5,
        state_id: 'SP',
        city_id: 'sao_paulo',
        neighborhood_id: 'pinheiros',
        description: 'Turno noturno movimentado com pizzas artesanais'
      },
      mockSupabase,
      'Pizzaria Napolitana Livre'
    );

    assert.strictEqual(jobCreationResult.success, true);
    assert.ok(jobCreationResult.job);
    assert.strictEqual(jobCreationResult.earnedXpBonus, true, 'Deve conceder bônus de XP por antecedência > 48h');
    const createdJob = jobCreationResult.job;
    assert.strictEqual(createdJob.status, 'open');

    // 2.1 Alerta Web Push filtrado por modal compatível
    const allCouriers = [
      {
        userId: courierUserId,
        stateId: 'SP',
        cityId: 'sao_paulo',
        homeNeighborhoodId: 'pinheiros',
        transportModal: 'motorcycle',
        pushToken: 'fcm-token-carlos'
      },
      {
        userId: competitorCourierId,
        stateId: 'SP',
        cityId: 'sao_paulo',
        homeNeighborhoodId: 'pinheiros',
        transportModal: 'bicycle',
        pushToken: 'fcm-token-roberto'
      }
    ];
    const eligibleCouriers = filterCouriersForJob(allCouriers, createdJob);
    assert.strictEqual(eligibleCouriers.length, 1);
    assert.strictEqual(eligibleCouriers[0].userId, courierUserId, 'Apenas motoboy deve receber o push');

    const pushPayload = formatJobPushPayload(createdJob, 'Pizzaria Napolitana Livre');
    assert.ok(pushPayload.title.includes('Pinheiros'));
    assert.ok(pushPayload.body.includes('130.00'));

    // =========================================================================
    // ETAPA 3: Feed, Negociação Bid/Ask e Fechamento de Matching (Epic 2 & 3)
    // =========================================================================
    // 3.1 Consulta de vagas abertas no feed do entregador
    const feedResult = await listOpenJobs({ city_id: 'sao_paulo', modal: 'motorcycle' }, mockSupabase);
    assert.strictEqual(feedResult.success, true);
    assert.ok(feedResult.jobs.some(j => j.id === createdJob.id));

    // 3.2 Submissão de Contraproposta (Bid) pelo Carlos Motoboy
    // Variação de tarifa: R$ 130 -> R$ 140 (+7.69%), compatível com a trava anti-manipulação de +-30%
    const rateVelocityCheck = validateRateVelocity(130.00, 140.00, new Date(Date.now() - 2 * 3600 * 1000).toISOString());
    assert.strictEqual(rateVelocityCheck.allowed, true);

    const bidResult = await submitBid(
      courierUserId,
      {
        job_id: createdJob.id,
        bid_daily_rate: 140.00,
        bid_delivery_fee: 9.00,
        notes: 'Tenho baú refrigerado e vasta experiência na região'
      },
      mockSupabase
    );

    assert.strictEqual(bidResult.success, true);
    assert.ok(bidResult.bid);
    const carlosBid = bidResult.bid;
    assert.strictEqual(carlosBid.status, 'pending');

    // 3.3 Aceite de Proposta pelo Lojista (Matching P2P com liberação de contatos)
    const matchResult = await acceptBid(
      storeUserId,
      createdJob.id,
      carlosBid.id,
      courierUserId,
      mockSupabase
    );

    assert.strictEqual(matchResult.success, true);
    assert.strictEqual(matchResult.job?.status, 'matched');
    assert.strictEqual(matchResult.job?.matched_courier_id, courierUserId);
    assert.strictEqual(matchResult.job?.matched_bid_id, carlosBid.id);

    // =========================================================================
    // ETAPA 4: Conclusão de Turno, Gamificação e Delight Moment PIX (Epic 2 & 4)
    // =========================================================================
    // 4.1 Conclusão do turno formalizada pelos participantes (+20 XP entregador, +10 XP lojista)
    const completionResult = await completeJob(storeUserId, createdJob.id, mockSupabase);
    assert.strictEqual(completionResult.success, true);
    assert.strictEqual(completionResult.job?.status, 'completed');
    assert.strictEqual(completionResult.courierEarnedXp, 20);
    assert.strictEqual(completionResult.storeEarnedXp, 10);

    // 4.2 Avaliação 5 estrelas concedida pelo Lojista ao Carlos
    const ratingResult = await submitJobRating(
      storeUserId,
      {
        job_id: createdJob.id,
        rated_user_id: courierUserId,
        rating: 5.0,
        comment: 'Pontualidade impecável e cuidado com as embalagens de pizza!'
      },
      mockSupabase
    );
    assert.strictEqual(ratingResult.success, true);

    // 4.3 Delight Moment 'rating_5_stars' acionado: Doação voluntária PIX
    const pixConfig = getPixConfig();
    assert.ok(pixConfig.brCodePayload.startsWith('000201'));

    DonationService.setInitialSupporterState(courierUserId, {
      xpPoints: 220,
      level: 'Bronze',
      communitySupporter: false,
      monthlyDonationsCount: 0
    });

    // Simula clique de cópia no Bottom Sheet de microdoação (R$ 5,00)
    const donationResult = await DonationService.logDonationCopy({
      userId: courierUserId,
      triggerMoment: 'rating_5_stars',
      suggestedAmount: 5.00
    });

    assert.strictEqual(donationResult.success, true);
    assert.ok(donationResult.reward, 'Deve retornar recompensa calculada');
    assert.strictEqual(donationResult.reward.communitySupporter, false, 'Sem badge individual para assegurar isonomia e blindagem fiscal');
    assert.strictEqual(donationResult.reward.xpAwarded, 0, 'Não deve conceder XP por doação');
    assert.strictEqual(donationResult.reward.totalXp, 220, 'XP deve permanecer inalterado');

    const supporterStatus = await DonationService.getUserSupporterStatus(courierUserId);
    assert.strictEqual(supporterStatus.communitySupporter, false);
    assert.strictEqual(supporterStatus.xpPoints, 220);

    // 4.4 Painel de Transparência reflete o apoio coletivo
    const transparencyReport = await DonationService.getTransparencyReport();
    assert.strictEqual(transparencyReport.totalEstimatedAmount, 5.00);
    assert.strictEqual(transparencyReport.uniqueDonorsCount, 1);
    assert.strictEqual(transparencyReport.isGoalReached, false);
    assert.strictEqual(transparencyReport.remainingAmount, 145.00);

    // =========================================================================
    // ETAPA 5: Disparo de Webhook Assinado HMAC-SHA256 para Integrador (Epic 5)
    // =========================================================================
    // Registra subscrição de webhook do sistema parceiro (PDV)
    WebhookDispatcherService.registerMockSubscription({
      id: 'sub-partner-e2e',
      clientId: partnerClientId,
      targetUrl: 'https://api.parceiro-pdv.com.br/webhooks/delivrery',
      secretToken: partnerWebhookSecret,
      eventType: 'job.completed',
      isActive: true
    });

    let interceptedWebhook = null;
    const mockPartnerFetch = async (url, options) => {
      interceptedWebhook = {
        url: url.toString(),
        headers: options.headers,
        body: JSON.parse(options.body)
      };
      return new Response('OK', { status: 200 });
    };

    const webhookEventData = {
      jobId: createdJob.id,
      storeId: storeUserId,
      courierId: courierUserId,
      finalRate: 140.00,
      deliveryFee: 9.00,
      status: 'completed'
    };

    const dispatchResults = await WebhookDispatcherService.dispatch(
      'job.completed',
      webhookEventData,
      { fetchFn: mockPartnerFetch, baseDelayMs: 5 }
    );

    assert.strictEqual(dispatchResults.length, 1);
    assert.strictEqual(dispatchResults[0].success, true);
    assert.ok(interceptedWebhook, 'Webhook deve ter sido recebido pelo parceiro');

    // Validação criptográfica do parceiro via SDK Delivrery
    const receivedSignature = interceptedWebhook.headers['X-Signature-SHA256'];
    const isSignatureValid = verifyWebhookSignature(
      partnerWebhookSecret,
      interceptedWebhook.body,
      receivedSignature
    );
    assert.strictEqual(isSignatureValid, true, 'Assinatura HMAC-SHA256 deve ser validada com sucesso');

    // =========================================================================
    // ETAPA 6: Acionamento via Web Component <delivrery-button /> (Epic 5)
    // =========================================================================
    const ButtonConstructor = globalThis.customElements.get('delivrery-button');
    assert.ok(ButtonConstructor, '<delivrery-button /> deve estar registrado no customElements registry');

    const buttonInstance = new ButtonConstructor();
    buttonInstance.setAttribute('theme', 'delivrery-orange');
    buttonInstance.setAttribute('label', 'Chamar Entregador Local');
    buttonInstance.setAttribute('city-id', 'sao_paulo');
    buttonInstance.setAttribute('modal', 'motorcycle');

    if (typeof buttonInstance.connectedCallback === 'function') {
      buttonInstance.connectedCallback();
    }

    assert.ok(buttonInstance.shadowRoot, 'Deve conter Shadow DOM montado');
    assert.strictEqual(buttonInstance.getAttribute('theme'), 'delivrery-orange');
  });
});

describe('E2E Integrated Journey: Casos Críticos de Resiliência e Regras de Segurança (Edge Cases)', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  it('Caso 1: Anti-Manipulação de Preço — Bloqueio de Proposta com Variação Tarifária Abusiva (FR-9)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    // Tentativa de aumento abusivo de +70% (R$ 100 -> R$ 170) em janela menor que 12h
    const result = validateRateVelocity(100.00, 170.00, twoHoursAgo);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.maxAllowed, 130.00);
    assert.match(result.message || '', /Trava de velocidade tarifária/);
    assert.ok(result.timeRemainingHours > 0);
  });

  it('Caso 2: Integridade de Matching P2P — Bloqueio de Aceite Duplo ou Proposta em Vaga Já Fechada', async () => {
    const mockStorage = createMockSupabase({
      job_posts: [
        {
          id: 'job-closed-123',
          store_id: 'store-1',
          status: 'matched',
          matched_courier_id: 'courier-original'
        }
      ]
    });

    const submitAttempt = await submitBid(
      'courier-late-arrival',
      {
        job_id: 'job-closed-123',
        bid_daily_rate: 120.00,
        bid_delivery_fee: 7.00
      },
      mockStorage
    );

    assert.strictEqual(submitAttempt.success, false);
    assert.match(submitAttempt.error || '', /preenchida por outro entregador/);
  });

  it('Caso 3: Filtro Ergonômico de Modal — Exclusão de Vagas com Raio > 3.0km para Bicicletas Convencionais (FR-6)', () => {
    const longDistanceJob = {
      id: 'job-long-1',
      delivery_radius_km: 4.8,
      accepted_modals: ['motorcycle', 'bicycle']
    };

    // Para motocicletas: permitido
    assert.strictEqual(isJobCompatibleWithModal(longDistanceJob, 'motorcycle'), true);

    // Para bicicletas convencionais: proibido (limite ergonômico <= 3.0km)
    assert.strictEqual(isJobCompatibleWithModal(longDistanceJob, 'bicycle'), false);
  });

  it('Caso 4: Isolamento Multi-Tenant Headless — Rejeição 403 Forbidden para Cidade Não Autorizada (FR-3, NFR-5)', async () => {
    const testApiKey = 'dlv_live_regional_partner_sp_only';
    ApiGatewayService.clearMockClients();
    HeadlessApiRouter.clearMocks();

    ApiGatewayService.registerMockClient({
      id: 'client-regional-sp',
      clientName: 'Restaurante Exclusivo SP',
      apiKeyHash: hashApiKey(testApiKey),
      ownerEmail: 'sp@restaurante.com.br',
      allowedCities: ['sao_paulo'],
      rateLimitRpm: 120,
      isActive: true
    });

    const forbiddenResponse = await HeadlessApiRouter.handle({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { 'X-API-Key': testApiKey },
      body: {
        shiftStartTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        shiftEndTime: new Date(Date.now() + 28 * 3600 * 1000).toISOString(),
        offeredDailyRate: 120.00,
        offeredDeliveryFee: 7.00,
        acceptedModals: ['motorcycle'],
        cityId: 'curitiba', // Cidade fora do escopo autorizado
        stateId: 'PR',
        neighborhoodId: 'centro'
      }
    });

    assert.strictEqual(forbiddenResponse.status, 403);
    assert.strictEqual(forbiddenResponse.body.status, 403);
    assert.strictEqual(forbiddenResponse.body.title, 'Acesso Não Autorizado para Município');
    assert.match(forbiddenResponse.body.detail, /Acesso não autorizado para o município/i);
  });

  it('Caso 5: Integridade Criptográfica — Rejeição de Webhook com Assinatura Adulterada (NFR-6)', () => {
    const secret = 'whsec_cryptographic_test_key_987654';
    const payload = { event: 'job.matched', jobId: 'job-100', amount: 120.00 };
    const validSignature = WebhookCrypto.generateSignature(secret, payload);

    // Payload adulterado por man-in-the-middle
    const tamperedPayload = { event: 'job.matched', jobId: 'job-100', amount: 999.00 };

    const isValid = verifyWebhookSignature(secret, tamperedPayload, validSignature);
    assert.strictEqual(isValid, false, 'Assinatura deve ser rejeitada após adulteração do payload');
  });
});
