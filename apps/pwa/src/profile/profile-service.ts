/**
 * @file profile-service.ts
 * @description Camada de serviço desacoplada para complementação e consulta de perfis de usuário.
 * Suporta Entregadores (courier_profiles) e Lojistas (store_profiles) com RLS e validações estritas (FR-2, AD-8, AD-10).
 */

import { supabase } from '../lib/supabase.ts';
import { validateCPF, validatePhone, cleanDigits, formatCPF, formatPhone } from './cpf-validator.ts';

export type TransportModal = 'motorcycle' | 'bicycle' | 'ebike_scooter';

export interface CourierProfileInput {
  userId: string;
  fullName: string;
  cpf: string;
  phoneNumber: string;
  transportModal: TransportModal;
  baseDailyRate: number;
  baseDeliveryFee: number;
  stateId: string;
  cityId: string;
  homeNeighborhoodId: string;
  referredByCode?: string;
}

export interface StoreProfileInput {
  userId: string;
  fullName: string;
  cpf: string;
  phoneNumber: string;
  storeName: string;
  addressStreet?: string;
  addressNumber?: string;
  latitude?: number;
  longitude?: number;
  stateId: string;
  cityId: string;
  neighborhoodId: string;
}

export interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    cpf: string;
    phoneNumber: string;
    userType: 'courier' | 'store';
  };
  profile: any;
}

/**
 * Gera um código de indicação viral único alfanumérico em maiúsculas (ex: LIVRE-K9X2P4).
 */
export function generateReferralCode(prefix = 'LIVRE'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclui caracteres ambíguos (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars.charAt(randomIndex);
  }
  return `${prefix}-${code}`;
}

export class ProfileService {
  /**
   * Completa o cadastro de um perfil de Entregador / Motoboy.
   */
  public static async completeCourierProfile(input: CourierProfileInput): Promise<UserProfileResponse> {
    // 1. Validações rigorosas de entrada
    if (!input.userId) {
      throw new Error('Identificador do usuário autenticado é obrigatório.');
    }

    if (!input.fullName || input.fullName.trim().length < 3) {
      throw new Error('Informe o nome completo (mínimo de 3 caracteres).');
    }

    if (!validateCPF(input.cpf)) {
      throw new Error('CPF inválido. Verifique os dígitos digitados.');
    }

    if (!validatePhone(input.phoneNumber)) {
      throw new Error('Telefone celular inválido. Informe o DDD e o número com 9 dígitos.');
    }

    const validModals: TransportModal[] = ['motorcycle', 'bicycle', 'ebike_scooter'];
    if (!validModals.includes(input.transportModal)) {
      throw new Error('Modal de transporte selecionado é inválido.');
    }

    if (input.baseDailyRate < 0 || input.baseDeliveryFee < 0) {
      throw new Error('As tarifas base não podem ter valores negativos.');
    }

    if (!input.stateId || !input.cityId || !input.homeNeighborhoodId) {
      throw new Error('Selecione seu Estado, Cidade e Bairro de atuação.');
    }

    const formattedCpf = formatCPF(input.cpf);
    const formattedPhone = formatPhone(input.phoneNumber);

    // 2. Resolução opcional de indicação
    let referredById: string | null = null;
    if (input.referredByCode && input.referredByCode.trim().length > 0) {
      const { data: referrerData } = await supabase
        .from('courier_profiles')
        .select('user_id')
        .eq('referral_code', input.referredByCode.trim().toUpperCase())
        .maybeSingle();

      if (referrerData && referrerData.user_id) {
        referredById = referrerData.user_id;
      }
    }

    // 3. Atualização de public.users
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .update({
        full_name: input.fullName.trim(),
        cpf: formattedCpf,
        phone_number: formattedPhone,
        user_type: 'courier',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.userId)
      .select()
      .single();

    if (userError) {
      if (userError.code === '23505' && userError.message?.includes('users_cpf_key')) {
        throw new Error('Este CPF já está cadastrado na plataforma.');
      }
      throw new Error(`Erro ao atualizar dados de usuário: ${userError.message}`);
    }

    // 4. Criação ou atualização do courier_profile preservando código de indicação e rate_updated_at se inalterado
    const { data: existingProfile } = await supabase
      .from('courier_profiles')
      .select('referral_code, xp_points, level, base_daily_rate, base_delivery_fee, rate_updated_at')
      .eq('user_id', input.userId)
      .maybeSingle();

    let rateUpdatedAt = new Date().toISOString();

    if (existingProfile) {
      const ratesChanged =
        Number(existingProfile.base_daily_rate) !== Number(input.baseDailyRate) ||
        Number(existingProfile.base_delivery_fee) !== Number(input.baseDeliveryFee);

      if (ratesChanged) {
        const dailyValidation = validateRateVelocity(
          existingProfile.base_daily_rate,
          input.baseDailyRate,
          existingProfile.rate_updated_at
        );
        if (!dailyValidation.allowed) {
          throw new Error(dailyValidation.message);
        }

        const feeValidation = validateRateVelocity(
          existingProfile.base_delivery_fee,
          input.baseDeliveryFee,
          existingProfile.rate_updated_at
        );
        if (!feeValidation.allowed) {
          throw new Error(feeValidation.message);
        }

        rateUpdatedAt = new Date().toISOString();
      } else {
        // Preserva o timestamp anterior para não reiniciar indevidamente a janela de 12h
        rateUpdatedAt = existingProfile.rate_updated_at || new Date().toISOString();
      }
    }

    let courierProfile: any = null;
    let courierError: any = null;
    let attempts = 0;

    while (attempts < 3) {
      const referralCode = existingProfile?.referral_code || generateReferralCode('LIVRE');
      const { data, error } = await supabase
        .from('courier_profiles')
        .upsert({
          user_id: input.userId,
          transport_modal: input.transportModal,
          base_daily_rate: input.baseDailyRate,
          base_delivery_fee: input.baseDeliveryFee,
          xp_points: existingProfile?.xp_points ?? 0,
          level: existingProfile?.level ?? 'Bronze',
          referral_code: referralCode,
          referred_by_id: referredById,
          state_id: input.stateId.toUpperCase(),
          city_id: input.cityId,
          home_neighborhood_id: input.homeNeighborhoodId,
          rate_updated_at: rateUpdatedAt,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!error) {
        courierProfile = data;
        courierError = null;
        break;
      }

      courierError = error;
      if (error.code === '23505' && error.message?.includes('referral_code') && !existingProfile?.referral_code) {
        attempts++;
        continue;
      }
      break;
    }

    if (courierError || !courierProfile) {
      throw new Error(`Erro ao salvar perfil do entregador: ${courierError?.message || 'Falha na persistência'}`);
    }

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        cpf: updatedUser.cpf,
        phoneNumber: updatedUser.phone_number,
        userType: 'courier'
      },
      profile: courierProfile
    };
  }

  /**
   * Completa o cadastro de um perfil de Lojista / Estabelecimento Comercial.
   */
  public static async completeStoreProfile(input: StoreProfileInput): Promise<UserProfileResponse> {
    // 1. Validações rigorosas de entrada
    if (!input.userId) {
      throw new Error('Identificador do usuário autenticado é obrigatório.');
    }

    if (!input.fullName || input.fullName.trim().length < 3) {
      throw new Error('Informe o nome do responsável (mínimo de 3 caracteres).');
    }

    if (!validateCPF(input.cpf)) {
      throw new Error('CPF do responsável inválido. Verifique os números digitados.');
    }

    if (!validatePhone(input.phoneNumber)) {
      throw new Error('Telefone de contato inválido. Informe o DDD e o número celular.');
    }

    if (!input.storeName || input.storeName.trim().length < 2) {
      throw new Error('Informe o nome fantasia ou razão social da loja.');
    }

    if (!input.stateId || !input.cityId || !input.neighborhoodId) {
      throw new Error('Selecione o Estado, Cidade e Bairro do estabelecimento.');
    }

    const formattedCpf = formatCPF(input.cpf);
    const formattedPhone = formatPhone(input.phoneNumber);

    // 2. Atualização de public.users
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .update({
        full_name: input.fullName.trim(),
        cpf: formattedCpf,
        phone_number: formattedPhone,
        user_type: 'store',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.userId)
      .select()
      .single();

    if (userError) {
      if (userError.code === '23505' && userError.message?.includes('users_cpf_key')) {
        throw new Error('Este CPF já está cadastrado na plataforma.');
      }
      throw new Error(`Erro ao atualizar dados de usuário: ${userError.message}`);
    }

    // 3. Criação do store_profile com reputação inicial 5.00
    const { data: storeProfile, error: storeError } = await supabase
      .from('store_profiles')
      .upsert({
        user_id: input.userId,
        store_name: input.storeName.trim(),
        address_street: input.addressStreet?.trim() || 'Não informado',
        address_number: input.addressNumber?.trim() || 'S/N',
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        state_id: input.stateId.toUpperCase(),
        city_id: input.cityId,
        neighborhood_id: input.neighborhoodId,
        reputation_score: 5.00,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (storeError) {
      throw new Error(`Erro ao salvar perfil do lojista: ${storeError.message}`);
    }

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        cpf: updatedUser.cpf,
        phoneNumber: updatedUser.phone_number,
        userType: 'store'
      },
      profile: storeProfile
    };
  }

  /**
   * Consulta o perfil consolidado do usuário autenticado atual.
   */
  public static async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return null;
    }

    let profileData: any = null;
    if (user.user_type === 'courier') {
      const { data: courier } = await supabase
        .from('courier_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      profileData = courier;
    } else if (user.user_type === 'store') {
      const { data: store } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      profileData = store;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        cpf: user.cpf,
        phoneNumber: user.phone_number,
        userType: user.user_type
      },
      profile: profileData
    };
  }

  public static validateRateVelocity = validateRateVelocity;

  /**
   * Atualiza as tarifas base do entregador respeitando a trava de velocidade tarifária (FR-9).
   */
  public static async updateCourierRates(input: {
    userId: string;
    baseDailyRate: number;
    baseDeliveryFee: number;
  }): Promise<{ success: boolean; profile: any }> {
    if (!input.userId) {
      throw new Error('Identificador do usuário é obrigatório.');
    }

    if (input.baseDailyRate < 0 || input.baseDeliveryFee < 0) {
      throw new Error('As tarifas não podem ter valores negativos.');
    }

    const { data: currentProfile } = await supabase
      .from('courier_profiles')
      .select('base_daily_rate, base_delivery_fee, rate_updated_at')
      .eq('user_id', input.userId)
      .maybeSingle();

    if (currentProfile) {
      const dailyValidation = validateRateVelocity(
        currentProfile.base_daily_rate,
        input.baseDailyRate,
        currentProfile.rate_updated_at
      );

      if (!dailyValidation.allowed) {
        const err = new Error(dailyValidation.message);
        (err as any).status = 400;
        (err as any).details = dailyValidation;
        throw err;
      }

      const feeValidation = validateRateVelocity(
        currentProfile.base_delivery_fee,
        input.baseDeliveryFee,
        currentProfile.rate_updated_at
      );

      if (!feeValidation.allowed) {
        const err = new Error(feeValidation.message);
        (err as any).status = 400;
        (err as any).details = feeValidation;
        throw err;
      }
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('courier_profiles')
      .update({
        base_daily_rate: input.baseDailyRate,
        base_delivery_fee: input.baseDeliveryFee,
        rate_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', input.userId)
      .select()
      .maybeSingle();

    if (updateError) {
      const err = new Error(`Erro ao atualizar tarifas do entregador: ${updateError.message}`);
      (err as any).status = 400;
      throw err;
    }

    return {
      success: true,
      profile: updatedProfile || {
        userId: input.userId,
        baseDailyRate: input.baseDailyRate,
        baseDeliveryFee: input.baseDeliveryFee,
        rateUpdatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Atualiza as tarifas padrão do lojista respeitando a trava de velocidade tarifária (FR-9).
   */
  public static async updateStoreRates(input: {
    userId: string;
    defaultDailyRate: number;
    defaultDeliveryFee: number;
  }): Promise<{ success: boolean; profile: any }> {
    if (!input.userId) {
      throw new Error('Identificador do lojista é obrigatório.');
    }

    if (input.defaultDailyRate < 0 || input.defaultDeliveryFee < 0) {
      throw new Error('As tarifas não podem ter valores negativos.');
    }

    const { data: currentProfile } = await supabase
      .from('store_profiles')
      .select('default_daily_rate, default_delivery_fee, rate_updated_at')
      .eq('user_id', input.userId)
      .maybeSingle();

    if (currentProfile) {
      const dailyValidation = validateRateVelocity(
        currentProfile.default_daily_rate || 0,
        input.defaultDailyRate,
        currentProfile.rate_updated_at
      );

      if (!dailyValidation.allowed) {
        const err = new Error(dailyValidation.message);
        (err as any).status = 400;
        (err as any).details = dailyValidation;
        throw err;
      }

      const feeValidation = validateRateVelocity(
        currentProfile.default_delivery_fee || 0,
        input.defaultDeliveryFee,
        currentProfile.rate_updated_at
      );

      if (!feeValidation.allowed) {
        const err = new Error(feeValidation.message);
        (err as any).status = 400;
        (err as any).details = feeValidation;
        throw err;
      }
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('store_profiles')
      .update({
        default_daily_rate: input.defaultDailyRate,
        default_delivery_fee: input.defaultDeliveryFee,
        rate_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', input.userId)
      .select()
      .maybeSingle();

    if (updateError) {
      const err = new Error(`Erro ao atualizar tarifas da loja: ${updateError.message}`);
      (err as any).status = 400;
      throw err;
    }

    return {
      success: true,
      profile: updatedProfile || {
        userId: input.userId,
        defaultDailyRate: input.defaultDailyRate,
        defaultDeliveryFee: input.defaultDeliveryFee,
        rateUpdatedAt: new Date().toISOString()
      }
    };
  }
}

export interface RateVelocityValidationResult {
  allowed: boolean;
  minAllowed: number;
  maxAllowed: number;
  timeRemainingMinutes: number;
  timeRemainingHours: number;
  message?: string;
}

/**
 * Validação pura da trava de velocidade tarifária (±30% em 12h - FR-9).
 */
export function validateRateVelocity(
  currentRate: number,
  newRate: number,
  lastUpdatedAt?: string | Date | number | null,
  maxVariation = 0.30,
  windowHours = 12
): RateVelocityValidationResult {
  if (currentRate <= 0 || !lastUpdatedAt) {
    return {
      allowed: true,
      minAllowed: 0,
      maxAllowed: Infinity,
      timeRemainingMinutes: 0,
      timeRemainingHours: 0
    };
  }

  const lastUpdatedMs = new Date(lastUpdatedAt).getTime();
  const timePassedMs = Date.now() - lastUpdatedMs;
  const windowMs = windowHours * 60 * 60 * 1000;

  if (timePassedMs >= windowMs) {
    return {
      allowed: true,
      minAllowed: 0,
      maxAllowed: Infinity,
      timeRemainingMinutes: 0,
      timeRemainingHours: 0
    };
  }

  const minAllowed = Math.round(currentRate * (1 - maxVariation) * 100) / 100;
  const maxAllowed = Math.round(currentRate * (1 + maxVariation) * 100) / 100;
  const timeRemainingMinutes = Math.max(1, Math.round((windowMs - timePassedMs) / (60 * 1000)));
  const timeRemainingHours = Math.round((timeRemainingMinutes / 60) * 10) / 10;

  if (newRate < minAllowed) {
    return {
      allowed: false,
      minAllowed,
      maxAllowed,
      timeRemainingMinutes,
      timeRemainingHours,
      message: `Trava de velocidade tarifária: alteração da tarifa (R$ ${newRate.toFixed(2)}) inferior ao piso permitido de R$ ${minAllowed.toFixed(2)} (-30%). Aguarde ${timeRemainingHours}h para alterações livres.`
    };
  }

  if (newRate > maxAllowed) {
    return {
      allowed: false,
      minAllowed,
      maxAllowed,
      timeRemainingMinutes,
      timeRemainingHours,
      message: `Trava de velocidade tarifária: alteração da tarifa (R$ ${newRate.toFixed(2)}) superior ao teto permitido de R$ ${maxAllowed.toFixed(2)} (+30%). Aguarde ${timeRemainingHours}h para alterações livres.`
    };
  }

  return {
    allowed: true,
    minAllowed,
    maxAllowed,
    timeRemainingMinutes,
    timeRemainingHours
  };
}
