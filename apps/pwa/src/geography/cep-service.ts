/**
 * @file cep-service.ts
 * @description Serviço de consulta e formatação de CEP brasileiro com resiliência,
 * timeout e fallback automático entre ViaCEP e BrasilAPI.
 */

export interface AddressLookupResult {
  success: boolean;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  error?: string;
}

/**
 * Remove qualquer caractere não numérico do CEP.
 */
export function cleanCEP(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Formata um valor de CEP para a máscara brasileira padrão (00000-000).
 */
export function formatCEP(value: string): string {
  const digits = cleanCEP(value).slice(0, 8);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Valida se a string representa um CEP brasileiro válido com 8 dígitos numéricos.
 */
export function validateCEP(value: string): boolean {
  const digits = cleanCEP(value);
  if (digits.length !== 8) return false;
  // Rejeita padrões absurdos com todos os dígitos iguais
  if (/^(\d)\1{7}$/.test(digits)) return false;
  return true;
}

/**
 * Executa uma requisição com timeout seguro via AbortController.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca dados de endereço completos a partir do CEP brasileiro.
 * Utiliza ViaCEP como provedor primário e BrasilAPI como fallback em caso de indisponibilidade.
 */
export async function fetchAddressByCep(
  rawCep: string,
  timeoutMs = 4000
): Promise<AddressLookupResult> {
  const digits = cleanCEP(rawCep);

  if (!validateCEP(digits)) {
    return {
      success: false,
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      postalCode: digits,
      error: 'CEP inválido. O CEP deve conter 8 dígitos numéricos.'
    };
  }

  // 1. Provedor Primário: ViaCEP
  try {
    const res = await fetchWithTimeout(`https://viacep.com.br/ws/${digits}/json/`, {}, timeoutMs);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          success: true,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: (data.uf || '').toUpperCase(),
          postalCode: formatCEP(digits)
        };
      }
    }
  } catch {
    // ViaCEP falhou ou sofreu timeout -> segue silenciosamente para o fallback
  }

  // 2. Provedor Secundário (Fallback): BrasilAPI
  try {
    const resFallback = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${digits}`, {}, timeoutMs);
    if (resFallback.ok) {
      const data = await resFallback.json();
      if (data && !data.errors) {
        return {
          success: true,
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: (data.state || '').toUpperCase(),
          postalCode: formatCEP(digits)
        };
      }
    }
  } catch {
    // Fallback também falhou
  }

  return {
    success: false,
    street: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: formatCEP(digits),
    error: 'Não foi possível localizar o endereço pelo CEP informado. Preencha os campos manualmente.'
  };
}
