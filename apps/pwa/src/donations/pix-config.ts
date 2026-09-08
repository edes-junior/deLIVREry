import type { PixConfiguration, ServerCostBreakdown, ServerCostItem } from './types.ts';

/**
 * Utilitário de formatação de bloco TLV (Tag-Length-Value) do padrão EMVCo / BACEN
 */
export function formatPixTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Cálculo do Checksum CRC16-CCITT (Polinômio 0x1021, Init 0xFFFF) conforme padrão BACEN do BR Code
 */
export function calculatePixCrc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMVCo
 */
export function sanitizePixText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Gerador de payload BR Code estático do PIX (EMVCo) sem dependências externas
 */
export function generatePixBrcode(params: {
  key: string;
  recipientName: string;
  city: string;
  amount?: number;
  txid?: string;
}): string {
  const { key, recipientName, city, amount, txid = '***' } = params;

  const sanitizedKey = key.trim();
  const sanitizedName = sanitizePixText(recipientName).slice(0, 25);
  const sanitizedCity = sanitizePixText(city).slice(0, 15);

  // Tag 00: Payload Format Indicator ('01')
  const tag00 = formatPixTLV('00', '01');

  // Tag 26: Merchant Account Information
  //   Subtag 00: GUI ('br.gov.bcb.pix')
  //   Subtag 01: PIX Key
  const subtag00 = formatPixTLV('00', 'br.gov.bcb.pix');
  const subtag01 = formatPixTLV('01', sanitizedKey);
  const tag26 = formatPixTLV('26', `${subtag00}${subtag01}`);

  // Tag 52: Merchant Category Code ('0000')
  const tag52 = formatPixTLV('52', '0000');

  // Tag 53: Transaction Currency ('986' para BRL)
  const tag53 = formatPixTLV('53', '986');

  // Tag 54: Transaction Amount (opcional em PIX Estático)
  let tag54 = '';
  if (amount !== undefined && amount > 0) {
    tag54 = formatPixTLV('54', amount.toFixed(2));
  }

  // Tag 58: Country Code ('BR')
  const tag58 = formatPixTLV('58', 'BR');

  // Tag 59: Merchant Name
  const tag59 = formatPixTLV('59', sanitizedName);

  // Tag 60: Merchant City
  const tag60 = formatPixTLV('60', sanitizedCity);

  // Tag 62: Additional Data Field Template (Subtag 05: txid)
  const subtag05 = formatPixTLV('05', txid);
  const tag62 = formatPixTLV('62', subtag05);

  // Payload parcial antes do CRC (Tag 63)
  const partialPayload = `${tag00}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const checksum = calculatePixCrc16(partialPayload);

  return `${partialPayload}${checksum}`;
}

/**
 * Lê variáveis de ambiente do cliente de forma isomórfica (process.env ou import.meta.env)
 */
function readEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  if (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env[key]
  ) {
    return (import.meta as any).env[key];
  }
  return undefined;
}

/**
 * Obtém a configuração do PIX ativa com resolução de variáveis de ambiente e fallback padrão
 */
export function getPixConfig(): PixConfiguration {
  const key =
    readEnvVar('VITE_PUBLIC_PIX_KEY') ||
    readEnvVar('PUBLIC_PIX_KEY') ||
    'apoio@delivrery.org';

  const recipientName =
    readEnvVar('VITE_PUBLIC_PIX_RECIPIENT_NAME') ||
    readEnvVar('PUBLIC_PIX_RECIPIENT_NAME') ||
    'Comunidade deLIVREry';

  const city =
    readEnvVar('VITE_PUBLIC_PIX_CITY') ||
    readEnvVar('PUBLIC_PIX_CITY') ||
    'SAO PAULO';

  const customPayload =
    readEnvVar('VITE_PUBLIC_PIX_BRCODE_PAYLOAD') ||
    readEnvVar('PUBLIC_PIX_BRCODE_PAYLOAD');

  const isCustomPayload = Boolean(customPayload && customPayload.trim().length > 0);

  const brCodePayload = isCustomPayload
    ? (customPayload as string).trim()
    : generatePixBrcode({ key, recipientName, city });

  return {
    key,
    recipientName,
    city,
    brCodePayload,
    isCustomPayload,
  };
}

/**
 * Retorna o detalhamento transparente dos custos mensais da infraestrutura do servidor (FR-12, NFR-8)
 */
export function getServerCostBreakdown(): ServerCostBreakdown {
  const customTargetStr =
    readEnvVar('VITE_PUBLIC_MONTHLY_SERVER_COST_BRL') ||
    readEnvVar('PUBLIC_MONTHLY_SERVER_COST_BRL');

  const defaultItems: ServerCostItem[] = [
    {
      id: 'supabase-db-auth',
      name: 'Supabase PostgreSQL & Auth',
      category: 'database',
      monthlyCostBrl: 85.0,
      description: 'Banco de dados transacional PostgreSQL 15, pooler de conexões e autenticação Magic Link',
    },
    {
      id: 'edge-hosting-cdn',
      name: 'Hospedagem Edge & CDN',
      category: 'hosting',
      monthlyCostBrl: 45.0,
      description: 'Distribuição estática do PWA em alta velocidade com cache de borda e certificado SSL',
    },
    {
      id: 'domain-dns',
      name: 'Domínio & DNS Brasil (.app.br)',
      category: 'domains',
      monthlyCostBrl: 20.0,
      description: 'Manutenção da anuidade de domínio nacional no Registro.br e zona DNS Anycast',
    },
  ];

  if (customTargetStr) {
    const parsedTarget = parseFloat(customTargetStr);
    if (!isNaN(parsedTarget) && parsedTarget > 0) {
      return {
        totalMonthlyTarget: parsedTarget,
        currency: 'BRL',
        items: defaultItems,
      };
    }
  }

  const defaultTotal = defaultItems.reduce((acc, item) => acc + item.monthlyCostBrl, 0);

  return {
    totalMonthlyTarget: defaultTotal,
    currency: 'BRL',
    items: defaultItems,
  };
}
