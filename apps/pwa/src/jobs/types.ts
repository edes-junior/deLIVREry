// ==============================================================================
// Types: apps/pwa/src/jobs/types.ts
// Description: Tipagens TypeScript para o domínio de Vagas e Propostas (Bid/Ask)
// Story: 2.1 - Schema de Vagas e Propostas com RLS e Isolamento de Contatos
// Architecture: Hexagonal Domain Models
// ==============================================================================

import type { TransportModal } from '../profile/types.ts';

export type JobStatus = 'open' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface JobPost {
  id: string;
  store_id: string;
  shift_start_time: string; // ISO 8601
  shift_end_time: string;   // ISO 8601
  offered_daily_rate: number;
  offered_delivery_fee: number;
  accepted_modals: TransportModal[];
  state_id: string;
  city_id: string;
  neighborhood_id: string;
  delivery_radius_km?: number;
  description?: string | null;
  status: JobStatus;
  matched_bid_id?: string | null;
  matched_courier_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface JobBid {
  id: string;
  job_id: string;
  courier_id: string;
  bid_daily_rate: number;
  bid_delivery_fee: number;
  status: BidStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Perfil público do entregador proponente (Story 3 / CAP-3, AD-10)
  courier_name?: string;
  courier_avatar_url?: string | null;
  courier_modal?: TransportModal;
  courier_level?: string;
  courier_xp?: number;
}

export interface MatchedJobContact {
  job_id: string;
  job_status: JobStatus;
  shift_start_time: string;
  shift_end_time: string;
  offered_daily_rate: number;
  offered_delivery_fee: number;
  store_id: string;
  store_name: string;
  store_contact_name: string;
  store_phone_number: string;
  store_avatar_url?: string | null;
  courier_id: string;
  courier_name: string;
  courier_phone_number: string;
  courier_avatar_url?: string | null;
  courier_modal: TransportModal;
  courier_level?: string;
  courier_xp?: number;
}

export interface CreateJobPostDTO {
  shift_start_time: string;
  shift_end_time: string;
  offered_daily_rate: number;
  offered_delivery_fee: number;
  accepted_modals: TransportModal[];
  state_id: string;
  city_id: string;
  neighborhood_id: string;
  delivery_radius_km?: number;
  description?: string;
}

export interface CreateJobBidDTO {
  job_id: string;
  bid_daily_rate: number;
  bid_delivery_fee: number;
  notes?: string;
}

export interface JobFilterParams {
  state_id?: string;
  city_id?: string;
  neighborhood_id?: string;
  neighborhood_ids?: string[];
  modal?: TransportModal;
  max_radius_km?: number;
  status?: JobStatus;
  courier_user_id?: string;
  exclude_conflicting_shifts?: boolean;
}

export interface JobRating {
  id: string;
  job_id: string;
  rater_id: string;
  rated_user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
}

export interface CreateJobRatingDTO {
  job_id: string;
  rated_user_id: string;
  rating: number;
  comment?: string;
}

export interface JobCompletionResult {
  success: boolean;
  job?: JobPost;
  courierEarnedXp?: number;
  storeEarnedXp?: number;
  error?: string;
}

export interface JobCancellationResult {
  success: boolean;
  job?: JobPost;
  penaltyApplied: boolean;
  penaltyXp?: number;
  error?: string;
}

