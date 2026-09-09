import { supabase } from '../lib/supabase.ts';

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface ProfileStatus {
  completed: boolean;
  userType?: 'courier' | 'store' | null;
  needsProfileCompletion: boolean;
}

/**
 * Valida sintaticamente o formato de e-mail antes do envio.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: 'O endereço de e-mail é obrigatório.' };
  }
  const cleanEmail = email.trim();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, error: 'Informe um endereço de e-mail válido.' };
  }
  return { valid: true };
}

/**
 * Dispara o Magic Link sem senha via Supabase Auth.
 */
export async function sendMagicLink(
  email: string,
  redirectTo?: string,
  client = supabase
): Promise<AuthResponse> {
  const validation = validateEmail(email);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || 'E-mail inválido.',
      error: validation.error,
    };
  }

  try {
    const defaultRedirect = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:5173/auth/callback';

    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo || defaultRedirect,
      },
    });

    if (error) {
      let friendlyMessage = error.message || 'Erro ao disparar link de acesso.';
      const lower = friendlyMessage.toLowerCase();
      if (lower.includes('rate limit') || (error as any).status === 429) {
        friendlyMessage = 'Limite de envio de e-mails atingido no Supabase (máx. 3-4 e-mails/hora no provedor padrão gratuito). Aguarde alguns minutos ou configure um provedor SMTP próprio no painel do Supabase.';
      }

      return {
        success: false,
        message: friendlyMessage,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Link de acesso enviado com sucesso! Verifique sua caixa de entrada.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Falha de conexão ao enviar link de acesso. Tente novamente.',
      error: err?.message || String(err),
    };
  }
}

/**
 * Retorna a sessão ativa atual persistida.
 */
export async function getSession(client = supabase) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  return data.session;
}

/**
 * Avalia se o usuário já completou seu perfil na plataforma deLIVREry.
 */
export async function checkProfileCompletion(
  userId: string,
  client = supabase
): Promise<ProfileStatus> {
  if (!userId) {
    return { completed: false, needsProfileCompletion: true, userType: null };
  }

  try {
    const { data: userRecord, error: userError } = await client
      .from('users')
      .select('cpf, user_type')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userRecord) {
      return { completed: false, needsProfileCompletion: true, userType: null };
    }

    const hasCpf = Boolean(userRecord.cpf && userRecord.cpf.trim());
    const hasType = Boolean(userRecord.user_type);

    if (!hasCpf || !hasType) {
      return {
        completed: false,
        needsProfileCompletion: true,
        userType: userRecord.user_type || null,
      };
    }

    return {
      completed: true,
      needsProfileCompletion: false,
      userType: userRecord.user_type,
    };
  } catch {
    return { completed: false, needsProfileCompletion: true, userType: null };
  }
}

/**
 * Encerra a sessão autenticada do usuário.
 */
export async function signOut(client = supabase) {
  await client.auth.signOut();
}

/**
 * Registra ouvinte para alterações no estado de autenticação.
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void,
  client = supabase
) {
  return client.auth.onAuthStateChange(callback);
}
