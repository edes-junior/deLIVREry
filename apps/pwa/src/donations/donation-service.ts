import { supabase } from '../lib/supabase.ts';
import type {
  DonationTriggerMoment,
  LogDonationInput,
  PixConfiguration,
  MonthlyDonationStats,
  DonationLogEntry,
} from './types.ts';
import { getPixConfig } from './pix-config.ts';

export const VALID_TRIGGER_MOMENTS: DonationTriggerMoment[] = [
  'shift_completed',
  'level_up',
  'emergency_matched',
  'rating_5_stars',
  'api_1000_requests',
  'manual_donation',
];

// Fallback em memória para testes offline e resiliência
const inMemoryDonationLogs: DonationLogEntry[] = [];

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
   * Registra o evento de cópia do BR Code PIX na tabela donations_log
   */
  public static async logDonationCopy(
    input: LogDonationInput
  ): Promise<{ success: boolean; id?: string; error?: string; inMemory?: boolean }> {
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

    const entry: DonationLogEntry = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random()}`,
      user_id: userId || null,
      trigger_moment: triggerMoment,
      suggested_amount: parsedAmount,
      copied_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Sempre salva no fallback em memória para integridade offline
    inMemoryDonationLogs.push(entry);

    // 3. Tenta persistência no Supabase com timeout defensivo de 40ms
    try {
      const insertQuery = (async () => {
        return await supabase
          .from('donations_log')
          .insert({
            user_id: userId || null,
            trigger_moment: triggerMoment,
            suggested_amount: parsedAmount,
          })
          .select('id')
          .single();
      })();

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        const timer = setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 40);
        timer.unref?.();
      });

      const { data, error } = await Promise.race([insertQuery, timeoutPromise]);

      if (!error && data?.id) {
        return { success: true, id: data.id, inMemory: false };
      }
    } catch {
      // Falha transparente sem bloquear a UX do usuário
    }

    return { success: true, id: entry.id, inMemory: true };
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
   * Limpa registros em memória (utilitário para isolamento em testes)
   */
  public static clearInMemoryLogs(): void {
    inMemoryDonationLogs.length = 0;
  }
}
