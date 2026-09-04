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
  courier_id: string;
  courier_name: string;
  courier_phone_number: string;
  courier_modal: TransportModal;
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
  modal?: TransportModal;
  max_radius_km?: number;
  status?: JobStatus;
}
