/**
 * @file cpf-validator.ts
 * @description Módulo canônico de validação e formatação de CPF e telefones brasileiros.
 * Atende aos requisitos FR-2 e AD-7 com algoritmo oficial de dígitos verificadores (Módulo 11).
 */

const VALID_BRAZILIAN_DDDS = new Set([
  // SP
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  // RJ / ES
  21, 22, 24, 27, 28,
  // MG
  31, 32, 33, 34, 35, 37, 38,
  // PR / SC
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  // RS
  51, 53, 54, 55,
  // Centro-Oeste / DF / TO / RO / AC
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  // BA / SE
  71, 73, 74, 75, 77, 79,
  // Nordeste (PE, AL, PB, RN, CE, PI, MA)
  81, 82, 83, 84, 85, 86, 87, 88, 89, 98, 99,
  // Norte (PA, AM, RR, AP)
  91, 92, 93, 94, 95, 96, 97
]);

/**
 * Remove todos os caracteres não numéricos de uma string.
 */
export function cleanDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Validação rigorosa de CPF via algoritmo oficial de dois dígitos verificadores (Módulo 11).
 * Rejeita valores não numéricos, tamanhos incorretos e sequências repetidas conhecidas.
 */
export function validateCPF(rawCpf: string | null | undefined): boolean {
  const cpf = cleanDigits(rawCpf);

  // CPF deve ter exatamente 11 dígitos numéricos
  if (cpf.length !== 11) {
    return false;
  }

  // Rejeita sequências com todos os dígitos iguais (ex: 000.000.000-00 ... 999.999.999-99)
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  // Cálculo do 1º Dígito Verificador (DV1)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let rest1 = (sum1 * 10) % 11;
  let dv1 = (rest1 === 10 || rest1 === 11) ? 0 : rest1;

  if (dv1 !== parseInt(cpf.charAt(9), 10)) {
    return false;
  }

  // Cálculo do 2º Dígito Verificador (DV2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  let rest2 = (sum2 * 10) % 11;
  let dv2 = (rest2 === 10 || rest2 === 11) ? 0 : rest2;

  return dv2 === parseInt(cpf.charAt(10), 10);
}

/**
 * Aplica máscara amigável ao CPF no formato 000.000.000-00.
 * Suporta formatação parcial durante a digitação no input.
 */
export function formatCPF(rawCpf: string | null | undefined): string {
  const digits = cleanDigits(rawCpf).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Validação rigorosa de telefone celular brasileiro com DDD.
 * Requer 11 dígitos no total: 2 dígitos de DDD válido + 9 dígitos de celular (iniciado por 9).
 */
export function validatePhone(rawPhone: string | null | undefined): boolean {
  const phone = cleanDigits(rawPhone);

  if (phone.length !== 11) {
    return false;
  }

  const ddd = parseInt(phone.slice(0, 2), 10);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return false;
  }

  // Primeiro dígito do número de celular no Brasil deve ser 9
  const firstMobileDigit = phone.charAt(2);
  if (firstMobileDigit !== '9') {
    return false;
  }

  // Não aceita sequência repetida no corpo do telefone
  const body = phone.slice(2);
  if (/^(\d)\1{8}$/.test(body)) {
    return false;
  }

  return true;
}

/**
 * Formata número de telefone brasileiro progressivamente no formato (00) 00000-0000.
 */
export function formatPhone(rawPhone: string | null | undefined): string {
  const digits = cleanDigits(rawPhone).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}
