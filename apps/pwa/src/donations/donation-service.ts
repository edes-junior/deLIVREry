import { supabase } from '../lib/supabase.ts';
import type {
  DonationTriggerMoment,
  LogDonationInput,
  PixConfiguration,
  MonthlyDonationStats,
  DonationLogEntry,
  CommunitySupporterReward,
  LogDonationResult,
  TransparencyReport,
  ServerCostBreakdown,
} from './types.ts';
import { getPixConfig, getServerCostBreakdown } from './pix-config.ts';

export const VALID_TRIGGER_MOMENTS: DonationTriggerMoment[] = [
  'shift_completed',
  'level_up',
  'emergency_matched',
  'rating_5_stars',
  'api_1000_requests',
  'manual_donation',
];

export interface UserSupporterState {
  xpPoints: number;
  level: 'Bronze' | 'Prata' | 'Ouro';
  communitySupporter: boolean;
  supporterSince?: string;
  lastDonationAt?: string;
  monthlyDonationsCount: number;
}

// Fallback em memória para testes offline e resiliência
const inMemoryDonationLogs: DonationLogEntry[] = [];
const inMemorySupporterStates: Map<string, UserSupporterState> = new Map();

export class DonationService {
  /**
   * Retorna a configuração ativa do PIX (Chave, Favorecido, Cidade, BR Code)
   */
  public static getPixConfig(): PixConfiguration {
    return getPixConfig();
  }

  /**
   * Valida se uma string é um momento disparador canônico de Delight Moment
   */
  public static isValidTriggerMoment(moment: string): moment is DonationTriggerMoment {
    return VALID_TRIGGER_MOMENTS.includes(moment as DonationTriggerMoment);
  }

  /**
   * Calcula o nível de gamificação com base no total de XP
   */
  public static calculateLevelFromXp(xp: number): 'Bronze' | 'Prata' | 'Ouro' {
    if (xp >= 1000) return 'Ouro';
    if (xp >= 300) return 'Prata';
    return 'Bronze';
  }

  /**
   * Verifica se é o primeiro apoio voluntário registrado pelo usuário no mês corrente
   */
  public static isUserFirstDonationOfMonth(userId: string, date: Date = new Date()): boolean {
    const targetMonth = date.getUTCMonth();
    const targetYear = date.getUTCFullYear();

    const previousInSameMonth = inMemoryDonationLogs.filter((log) => {
      if (log.user_id !== userId) return false;
      const logDate = new Date(log.copied_at || log.created_at || Date.now());
      return logDate.getUTCMonth() === targetMonth && logDate.getUTCFullYear() === targetYear;
    });

    return previousInSameMonth.length === 0;
  }

  /**
   * Registra o evento de cópia do BR Code PIX na tabela donations_log e processa recompensas de apoiador
   */
  public static async logDonationCopy(input: LogDonationInput): Promise<LogDonationResult> {
    const { userId = null, triggerMoment, suggestedAmount } = input;

    // 1. Validação de momento disparador
    if (!this.isValidTriggerMoment(triggerMoment)) {
      throw new Error(
        `Momento de doação inválido: '${triggerMoment}'. Momentos permitidos: ${VALID_TRIGGER_MOMENTS.join(', ')}`
      );
    }

    // 2. Validação de valor sugerido não-negativo
    const parsedAmount = Number(suggestedAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      throw new Error('O valor sugerido de doação deve ser um número não-negativo.');
    }

    const now = new Date();
    let reward: CommunitySupporterReward | undefined = undefined;

    // 3. Processa recompensa para usuário autenticado
    if (userId) {
      const isFirst = this.isUserFirstDonationOfMonth(userId, now);
      const userState = inMemorySupporterStates.get(userId) || {
        xpPoints: 0,
        level: 'Bronze',
        communitySupporter: false,
        monthlyDonationsCount: 0,
      };

      const xpBonus = isFirst ? 25 : 0;
      const newXp = userState.xpPoints + xpBonus;
      const newLevel = this.calculateLevelFromXp(newXp);

      userState.xpPoints = newXp;
      userState.level = newLevel;
      userState.communitySupporter = true;
      userState.lastDonationAt = now.toISOString();
      if (!userState.supporterSince) {
        userState.supporterSince = now.toISOString();
      }
      userState.monthlyDonationsCount += 1;
      inMemorySupporterStates.set(userId, userState);

      reward = {
        userId,
        isFirstOfMonth: isFirst,
        xpAwarded: xpBonus,
        communitySupporter: true,
        newLevel,
        totalXp: newXp,
      };
    }

    const entry: DonationLogEntry = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `log-${Date.now()}-${Math.random()}`,
      user_id: userId || null,
      trigger_moment: triggerMoment,
      suggested_amount: parsedAmount,
      copied_at: now.toISOString(),
      created_at: now.toISOString(),
    };

    // Sempre salva no fallback em memória para integridade offline
    inMemoryDonationLogs.push(entry);

    // 4. Tenta persistência no Supabase com timeout defensivo de 40ms e AbortSignal
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => {
      try {
        controller?.abort();
      } catch {}
    }, 40);
    timer.unref?.();

    try {
      let query: any = supabase
        .from('donations_log')
        .insert({
          user_id: userId || null,
          trigger_moment: triggerMoment,
          suggested_amount: parsedAmount,
        });

      if (controller?.signal && typeof query.abortSignal === 'function') {
        query = query.abortSignal(controller.signal);
      }

      const { data, error } = await query.select('id').single();
      clearTimeout(timer);

      if (!error && data?.id) {
        return { success: true, id: data.id, inMemory: false, reward };
      }
    } catch {
      // Falha transparente sem bloquear a UX do usuário
    }

    return { success: true, id: entry.id, inMemory: true, reward };
  }

  /**
   * Consulta o status de apoiador e XP de um usuário
   */
  public static async getUserSupporterStatus(userId: string): Promise<UserSupporterState> {
    // 1. Se já existir estado consolidado em memória, retorna instantaneamente (NFR-3 < 100ms)
    if (inMemorySupporterStates.has(userId)) {
      return inMemorySupporterStates.get(userId)!;
    }

    // 2. Consulta defensiva no Supabase com AbortSignal
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => {
      try {
        controller?.abort();
      } catch {}
    }, 40);
    timer.unref?.();

    try {
      let courierQuery: any = supabase
        .from('courier_profiles')
        .select(
          'community_supporter, supporter_since, last_donation_at, xp_points, level, monthly_donations_count'
        )
        .eq('user_id', userId);

      if (controller?.signal && typeof courierQuery.abortSignal === 'function') {
        courierQuery = courierQuery.abortSignal(controller.signal);
      }

      const { data: courier } = await courierQuery.maybeSingle();

      if (courier) {
        clearTimeout(timer);
        return {
          communitySupporter: Boolean(courier.community_supporter),
          supporterSince: courier.supporter_since,
          lastDonationAt: courier.last_donation_at,
          xpPoints: courier.xp_points || 0,
          level: (courier.level as any) || 'Bronze',
          monthlyDonationsCount: courier.monthly_donations_count || 0,
        };
      }

      let storeQuery: any = supabase
        .from('store_profiles')
        .select(
          'community_supporter, supporter_since, last_donation_at, xp_points, level, monthly_donations_count'
        )
        .eq('user_id', userId);

      if (controller?.signal && typeof storeQuery.abortSignal === 'function') {
        storeQuery = storeQuery.abortSignal(controller.signal);
      }

      const { data: store } = await storeQuery.maybeSingle();
      clearTimeout(timer);

      if (store) {
        return {
          communitySupporter: Boolean(store.community_supporter),
          supporterSince: store.supporter_since,
          lastDonationAt: store.last_donation_at,
          xpPoints: store.xp_points || 0,
          level: (store.level as any) || 'Bronze',
          monthlyDonationsCount: store.monthly_donations_count || 0,
        };
      }
    } catch {
      // Continua para fallback in-memory
    } finally {
      clearTimeout(timer);
    }

    return {
      communitySupporter: false,
      xpPoints: 0,
      level: 'Bronze',
      monthlyDonationsCount: 0,
    };
  }

  /**
   * Permite inicializar/definir o estado de XP/apoiador em memória (útil para testes)
   */
  public static setInitialSupporterState(userId: string, state: Partial<UserSupporterState>): void {
    const current = inMemorySupporterStates.get(userId) || {
      xpPoints: 0,
      level: 'Bronze',
      communitySupporter: false,
      monthlyDonationsCount: 0,
    };
    inMemorySupporterStates.set(userId, { ...current, ...state });
  }

  /**
   * Obtém estatísticas mensais de doação para o painel público de transparência
   */
  public static async getMonthlyDonationStats(options?: {
    month?: number;
    year?: number;
  }): Promise<MonthlyDonationStats> {
    const now = new Date();
    const targetMonth = options?.month !== undefined ? options.month : now.getUTCMonth() + 1;
    const targetYear = options?.year !== undefined ? options.year : now.getUTCFullYear();
    const monthKey = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;

    // 1. Tenta buscar da view pública monthly_donation_stats no Supabase
    try {
      const selectQuery = (async () => {
        return await supabase
          .from('monthly_donation_stats')
          .select('*')
          .order('month_period', { ascending: false })
          .limit(1);
      })();

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        const timer = setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 40);
        timer.unref?.();
      });

      const { data, error } = await Promise.race([selectQuery, timeoutPromise]);

      if (!error && data && data.length > 0) {
        const row = data[0];
        return {
          monthPeriod: row.month_period || monthKey,
          totalIntents: Number(row.total_intents || 0),
          totalEstimatedAmount: Number(row.total_estimated_amount || 0),
          uniqueDonorsCount: Number(row.unique_donors_count || 0),
          breakdownByMoment: {
            shift_completed: Number(row.count_shift_completed || 0),
            level_up: Number(row.count_level_up || 0),
            emergency_matched: Number(row.count_emergency_matched || 0),
            rating_5_stars: Number(row.count_rating_5_stars || 0),
            api_1000_requests: Number(row.count_api_1000_requests || 0),
            manual_donation: Number(row.count_manual_donation || 0),
          },
        };
      }
    } catch {
      // Em caso de falha de rede/Supabase, consolida a partir dos registros em memória
    }

    // 2. Fallback in-memory
    const breakdown: Record<DonationTriggerMoment, number> = {
      shift_completed: 0,
      level_up: 0,
      emergency_matched: 0,
      rating_5_stars: 0,
      api_1000_requests: 0,
      manual_donation: 0,
    };

    let totalAmount = 0;
    const uniqueUsers = new Set<string>();

    for (const log of inMemoryDonationLogs) {
      if (log.trigger_moment in breakdown) {
        breakdown[log.trigger_moment]++;
      }
      totalAmount += log.suggested_amount;
      if (log.user_id) {
        uniqueUsers.add(log.user_id);
      }
    }

    return {
      monthPeriod: monthKey,
      totalIntents: inMemoryDonationLogs.length,
      totalEstimatedAmount: Number(totalAmount.toFixed(2)),
      uniqueDonorsCount: uniqueUsers.size,
      breakdownByMoment: breakdown,
    };
  }

  /**
   * Obtém relatório consolidado de transparência pública de custos de servidor e meta coletiva (FR-12)
   */
  public static async getTransparencyReport(options?: {
    month?: number;
    year?: number;
  }): Promise<TransparencyReport> {
    const stats = await this.getMonthlyDonationStats(options);
    const costBreakdown = getServerCostBreakdown();
    const totalMonthlyTarget = costBreakdown.totalMonthlyTarget;
    const totalEstimatedAmount = stats.totalEstimatedAmount;

    const percentage =
      totalMonthlyTarget > 0
        ? Number(((totalEstimatedAmount / totalMonthlyTarget) * 100).toFixed(1))
        : 0;

    const isGoalReached = totalEstimatedAmount >= totalMonthlyTarget;
    const remainingAmount = Math.max(0, Number((totalMonthlyTarget - totalEstimatedAmount).toFixed(2)));

    return {
      monthPeriod: stats.monthPeriod,
      totalEstimatedAmount,
      totalMonthlyTarget,
      percentage,
      isGoalReached,
      remainingAmount,
      uniqueDonorsCount: stats.uniqueDonorsCount,
      totalIntents: stats.totalIntents,
      costBreakdown,
      breakdownByMoment: stats.breakdownByMoment,
    };
  }

  /**
   * Limpa registros e estados em memória (utilitário para isolamento em testes)
   */
  public static clearInMemoryLogs(): void {
    inMemoryDonationLogs.length = 0;
    inMemorySupporterStates.clear();
  }
}
