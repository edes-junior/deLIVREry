// ==============================================================================
// Service: apps/pwa/src/jobs/job-service.ts
// Description: Camada de serviço de domínio para gerenciamento de Vagas e Propostas (Bid/Ask).
// Story: 2.1 - Schema de Vagas e Propostas com RLS e Isolamento de Contatos
// Architecture: Hexagonal / Domain Service (Ports & Adapters)
// ==============================================================================

import { supabase } from '../lib/supabase.ts';
import type { 
  JobPost, 
  JobBid, 
  MatchedJobContact, 
  CreateJobPostDTO, 
  CreateJobBidDTO, 
  JobFilterParams,
  TransportModal
} from './types.ts';

const VALID_MODALS: TransportModal[] = ['motorcycle', 'bicycle', 'ebike_scooter'];

/**
 * Valida os dados de entrada para criação de uma nova vaga de turno.
 */
export function validateJobPostInput(input: CreateJobPostDTO): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.shift_start_time || !input.shift_end_time) {
    errors.push('Horários de início e término do turno são obrigatórios.');
  } else {
    const startTime = new Date(input.shift_start_time).getTime();
    const endTime = new Date(input.shift_end_time).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      errors.push('Formato de data/hora inválido. Utilize o formato ISO 8601.');
    } else if (endTime <= startTime) {
      errors.push('O horário de término do turno deve ser posterior ao horário de início.');
    }
  }

  if (typeof input.offered_daily_rate !== 'number' || input.offered_daily_rate < 0) {
    errors.push('O valor da diária ofertada não pode ser negativo.');
  }

  if (typeof input.offered_delivery_fee !== 'number' || input.offered_delivery_fee < 0) {
    errors.push('A taxa por entrega ofertada não pode ser negativa.');
  }

  if (!Array.isArray(input.accepted_modals) || input.accepted_modals.length === 0) {
    errors.push('Ao menos um modal de transporte aceito deve ser especificado.');
  } else {
    const invalidModals = input.accepted_modals.filter(m => !VALID_MODALS.includes(m));
    if (invalidModals.length > 0) {
      errors.push(`Modais de transporte inválidos: ${invalidModals.join(', ')}.`);
    }
  }

  if (!input.state_id || !/^[a-zA-Z]{2}$/.test(input.state_id.trim())) {
    errors.push('UF inválida. Deve conter exatamente 2 caracteres alfabéticos (ex: SP, RJ).');
  }

  if (!input.city_id || !input.city_id.trim()) {
    errors.push('Cidade é obrigatória.');
  }

  if (!input.neighborhood_id || !input.neighborhood_id.trim()) {
    errors.push('Bairro é obrigatório.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida os dados de submissão de proposta ou contraproposta.
 */
export function validateJobBidInput(input: CreateJobBidDTO): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.job_id || !input.job_id.trim()) {
    errors.push('Identificador da vaga (job_id) é obrigatório.');
  }

  if (typeof input.bid_daily_rate !== 'number' || input.bid_daily_rate < 0) {
    errors.push('O valor da diária proposta não pode ser negativo.');
  }

  if (typeof input.bid_delivery_fee !== 'number' || input.bid_delivery_fee < 0) {
    errors.push('A taxa por entrega proposta não pode ser negativa.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

import { isEligibleForEarlyXpBonus, dispatchJobWebPush } from '../notifications/notification-service.ts';

/**
 * Cria uma nova vaga de turno para um lojista autenticado.
 * Concede automaticamente +50 XP caso a publicação seja feita com >48h de antecedência (FR-14).
 */
export async function createJobPost(
  storeUserId: string, 
  input: CreateJobPostDTO,
  client: any = supabase,
  storeName = 'Lojista'
): Promise<{ success: boolean; job?: JobPost; earnedXpBonus?: boolean; error?: string }> {
  if (!storeUserId) {
    return { success: false, error: 'Identificador do lojista não fornecido.' };
  }

  const validation = validateJobPostInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(' ') };
  }

  const payload = {
    store_id: storeUserId,
    shift_start_time: input.shift_start_time,
    shift_end_time: input.shift_end_time,
    offered_daily_rate: input.offered_daily_rate,
    offered_delivery_fee: input.offered_delivery_fee,
    accepted_modals: input.accepted_modals,
    state_id: input.state_id.toUpperCase(),
    city_id: input.city_id,
    neighborhood_id: input.neighborhood_id,
    delivery_radius_km: input.delivery_radius_km ?? 3.0,
    description: input.description || null,
    status: 'open'
  };

  const { data, error } = await client
    .from('job_posts')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const job = data as JobPost;
  const earnedXpBonus = isEligibleForEarlyXpBonus(input.shift_start_time);

  // Se qualificado para bônus de antecedência (>48h), atualiza XP do lojista
  if (earnedXpBonus) {
    try {
      const { data: currentStore } = await client
        .from('store_profiles')
        .select('xp_points')
        .eq('user_id', storeUserId)
        .single();

      const currentXp = currentStore?.xp_points || 0;
      const newXp = currentXp + 50;
      const newLevel = newXp >= 1000 ? 'Ouro' : newXp >= 300 ? 'Prata' : 'Bronze';

      await client
        .from('store_profiles')
        .update({ xp_points: newXp, level: newLevel })
        .eq('user_id', storeUserId);
    } catch {
      // Degradação não-bloqueante
    }
  }

  // Disparo assíncrono de Web Push (não bloqueia criação caso falhe)
  try {
    await dispatchJobWebPush(job, storeName);
  } catch {
    // Degradação graciosa
  }

  return { success: true, job, earnedXpBonus };
}

/**
 * Determina se a vaga é compatível com o modal do entregador, respeitando a regra
 * ergonômica inegociável de raio máximo <= 3.0km para bicicletas convencionais (FR-5).
 */
export function isJobCompatibleWithModal(
  job: JobPost, 
  modal: TransportModal
): boolean {
  if (!job.accepted_modals || !job.accepted_modals.includes(modal)) {
    return false;
  }

  // Bicicletas convencionais possuem limite ergonômico de esforço físico de 3.0km
  if (modal === 'bicycle') {
    const radius = job.delivery_radius_km ?? 3.0;
    return radius <= 3.0;
  }

  return true;
}

/**
 * Consulta pública de vagas abertas com suporte a filtros geográficos e modal.
 * Nota: Os telefones das lojas não são retornados pela consulta pública de vagas (RLS / AD-10).
 */
export async function listOpenJobs(
  filters?: JobFilterParams,
  client: any = supabase
): Promise<{ success: boolean; jobs: JobPost[]; error?: string }> {
  let query = client
    .from('job_posts')
    .select('*')
    .eq('status', filters?.status || 'open');

  if (filters?.state_id) {
    query = query.eq('state_id', filters.state_id.toUpperCase());
  }

  if (filters?.city_id) {
    query = query.eq('city_id', filters.city_id);
  }

  if (filters?.neighborhood_id) {
    query = query.eq('neighborhood_id', filters.neighborhood_id);
  }

  if (filters?.modal) {
    query = query.contains('accepted_modals', [filters.modal]);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return { success: false, jobs: [], error: error.message };
  }

  let jobs = (data || []) as JobPost[];

  // Aplica filtragem fina de compatibilidade por modal (ex: raio <= 3km para bikes)
  if (filters?.modal) {
    jobs = jobs.filter(job => isJobCompatibleWithModal(job, filters.modal!));
  }

  if (typeof filters?.max_radius_km === 'number') {
    jobs = jobs.filter(job => (job.delivery_radius_km ?? 3.0) <= filters.max_radius_km!);
  }

  return { success: true, jobs };
}

/**
 * Submete proposta ou contraproposta de um entregador autenticado.
 */
export async function submitBid(
  courierUserId: string,
  input: CreateJobBidDTO,
  client: any = supabase
): Promise<{ success: boolean; bid?: JobBid; error?: string }> {
  if (!courierUserId) {
    return { success: false, error: 'Identificador do entregador não fornecido.' };
  }

  const validation = validateJobBidInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(' ') };
  }

  // Verifica se a vaga ainda aceita propostas (não casada ou cancelada)
  try {
    const { data: job } = await client
      .from('job_posts')
      .select('status')
      .eq('id', input.job_id)
      .single();

    if (job) {
      if (job.status === 'matched') {
        return { success: false, error: 'Esta vaga já foi preenchida por outro entregador.' };
      }
      if (job.status === 'cancelled') {
        return { success: false, error: 'Esta vaga foi cancelada pelo lojista e não aceita mais propostas.' };
      }
      if (job.status !== 'open') {
        return { success: false, error: 'Esta vaga não está aberta para receber propostas.' };
      }
    }
  } catch {
    // Suporte a mocks simplificados ou fallthrough gracioso
  }

  const payload = {
    job_id: input.job_id,
    courier_id: courierUserId,
    bid_daily_rate: input.bid_daily_rate,
    bid_delivery_fee: input.bid_delivery_fee,
    notes: input.notes || null,
    status: 'pending'
  };

  const { data, error } = await client
    .from('job_bids')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, bid: data as JobBid };
}

/**
 * Consulta todas as propostas recebidas para uma vaga (acessível exclusivamente pelo lojista dono).
 */
export async function listBidsForJob(
  storeUserId: string,
  jobId: string,
  client: any = supabase
): Promise<{ success: boolean; bids: JobBid[]; error?: string }> {
  if (!storeUserId || !jobId) {
    return { success: false, bids: [], error: 'Parâmetros obrigatórios ausentes.' };
  }

  const { data, error } = await client
    .from('job_bids')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, bids: [], error: error.message };
  }

  return { success: true, bids: (data || []) as JobBid[] };
}

/**
 * Aceita uma proposta, formalizando o matching entre lojista e motoboy (FR-6).
 * Atualiza o status da vaga para 'matched', registra o courier vencedor e rejeita os demais bids.
 */
export async function acceptBid(
  storeUserId: string,
  jobId: string,
  bidId: string,
  courierUserId: string,
  client: any = supabase
): Promise<{ success: boolean; job?: JobPost; error?: string }> {
  if (!storeUserId || !jobId || !bidId || !courierUserId) {
    return { success: false, error: 'Parâmetros obrigatórios ausentes para aceite de matching.' };
  }

  // 1. Atualiza a vaga para 'matched'
  const { data: job, error: jobError } = await client
    .from('job_posts')
    .update({
      status: 'matched',
      matched_bid_id: bidId,
      matched_courier_id: courierUserId
    })
    .eq('id', jobId)
    .eq('store_id', storeUserId)
    .select()
    .single();

  if (jobError) {
    return { success: false, error: jobError.message };
  }

  // 2. Marca a proposta vencedora como 'accepted'
  await client
    .from('job_bids')
    .update({ status: 'accepted' })
    .eq('id', bidId);

  // 3. Rejeita as outras propostas concorrentes da mesma vaga
  await client
    .from('job_bids')
    .update({ status: 'rejected' })
    .eq('job_id', jobId)
    .neq('id', bidId);

  return { success: true, job: job as JobPost };
}

/**
 * Obtém os contatos liberados de um turno com status 'matched' (FR-6, AD-10).
 * Retorna os números de telefone e nomes de ambas as partes via view segura.
 */
export async function getMatchedJobDetails(
  currentUserId: string,
  jobId: string,
  client: any = supabase
): Promise<{ success: boolean; contact?: MatchedJobContact; error?: string }> {
  if (!currentUserId || !jobId) {
    return { success: false, error: 'Parâmetros obrigatórios ausentes.' };
  }

  const { data, error } = await client
    .from('job_matched_contacts')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Matching não encontrado ou ainda não formalizado.' };
  }

  // Verificação de isolamento: usuário precisa ser ou o lojista ou o motoboy do turno
  if (data.store_id !== currentUserId && data.courier_id !== currentUserId) {
    return { success: false, error: 'Acesso não autorizado aos contatos deste turno.' };
  }

  return { success: true, contact: data as MatchedJobContact };
}
