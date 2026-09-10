/**
 * Tipos canônicos de microdoações comunitárias PIX e Delight Moments (Epic 4 / FR-10, FR-11)
 */

export type DonationTriggerMoment =
  | 'shift_completed'       // 1. Entregador após confirmação de pagamento do turno
  | 'level_up'              // 2. Entregador/Lojista ao subir de nível
  | 'emergency_matched'     // 3. Lojista com vaga de emergência aceita em < 5min
  | 'rating_5_stars'        // 4. Lojista avaliando entregador com 5 estrelas
  | 'api_1000_requests'     // 5. Parceiro API atingindo 1.000 requisições de sucesso
  | 'manual_donation';      // Doação voluntária espontânea (ex: rodapé ou painel de transparência)

export interface DonationLogEntry {
  id?: string;
  user_id?: string | null;
  trigger_moment: DonationTriggerMoment;
  suggested_amount: number;
  copied_at?: string;
  created_at?: string;
}

export interface LogDonationInput {
  userId?: string | null;
  triggerMoment: DonationTriggerMoment;
  suggestedAmount: number;
}

export interface PixConfiguration {
  key: string;
  recipientName: string;
  city: string;
  brCodePayload: string;
  isCustomPayload: boolean;
}

export interface MonthlyDonationStats {
  monthPeriod: string;
  totalIntents: number;
  totalEstimatedAmount: number;
  uniqueDonorsCount: number;
  breakdownByMoment: Record<DonationTriggerMoment, number>;
}

export interface CommunitySupporterReward {
  userId: string;
  isFirstOfMonth: boolean;
  xpAwarded: number;
  communitySupporter: boolean;
  newLevel?: string;
  totalXp?: number;
}

export interface LogDonationResult {
  success: boolean;
  id?: string;
  error?: string;
  inMemory?: boolean;
  reward?: CommunitySupporterReward;
}

export interface ServerCostItem {
  id: string;
  name: string;
  category: 'database' | 'hosting' | 'domains' | 'services';
  monthlyCostBrl: number;
  description: string;
}

export interface ServerCostBreakdown {
  totalMonthlyTarget: number;
  currency: 'BRL';
  items: ServerCostItem[];
}

export type OperationalHealthLevel = 'basic' | 'healthy' | 'accelerated';

export interface OperationalHealthInfo {
  level: OperationalHealthLevel;
  statusLabel: string;
  description: string;
}

export interface TransparencyReport {
  monthPeriod: string;
  totalEstimatedAmount: number;
  totalMonthlyTarget: number;
  percentage: number;
  isGoalReached: boolean;
  remainingAmount: number;
  uniqueDonorsCount: number;
  totalIntents: number;
  costBreakdown: ServerCostBreakdown;
  breakdownByMoment: Record<DonationTriggerMoment, number>;
  healthLevel: OperationalHealthLevel;
  healthStatusLabel: string;
  healthDescription: string;
}

