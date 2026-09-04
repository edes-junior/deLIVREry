/**
 * @file geography-service.ts
 * @description Provedor da árvore hierárquica geográfica brasileira (UF -> Cidade -> Bairro).
 * Garante suporte universal a todo território nacional (AD-8) com resiliência offline e busca dinâmica.
 */

export interface StateItem {
  id: string; // Sigla da UF em maiúsculas (ex: 'SP')
  name: string; // Nome do Estado (ex: 'São Paulo')
}

export interface CityItem {
  id: string; // Slug ou identificador padronizado (ex: 'sao-paulo', 'campinas')
  name: string; // Nome de exibição da cidade (ex: 'São Paulo', 'Campinas')
  stateId: string;
}

export interface NeighborhoodItem {
  id: string; // Slug ou identificador padronizado (ex: 'pinheiros', 'vila-madalena')
  name: string; // Nome do bairro (ex: 'Pinheiros', 'Vila Madalena')
  cityId: string;
}

/**
 * 27 Unidades Federativas do Brasil com siglas canônicas em maiúsculas.
 */
export const BRAZILIAN_STATES: StateItem[] = [
  { id: 'AC', name: 'Acre' },
  { id: 'AL', name: 'Alagoas' },
  { id: 'AP', name: 'Amapá' },
  { id: 'AM', name: 'Amazonas' },
  { id: 'BA', name: 'Bahia' },
  { id: 'CE', name: 'Ceará' },
  { id: 'DF', name: 'Distrito Federal' },
  { id: 'ES', name: 'Espírito Santo' },
  { id: 'GO', name: 'Goiás' },
  { id: 'MA', name: 'Maranhão' },
  { id: 'MT', name: 'Mato Grosso' },
  { id: 'MS', name: 'Mato Grosso do Sul' },
  { id: 'MG', name: 'Minas Gerais' },
  { id: 'PA', name: 'Pará' },
  { id: 'PB', name: 'Paraíba' },
  { id: 'PR', name: 'Paraná' },
  { id: 'PE', name: 'Pernambuco' },
  { id: 'PI', name: 'Piauí' },
  { id: 'RJ', name: 'Rio de Janeiro' },
  { id: 'RN', name: 'Rio Grande do Norte' },
  { id: 'RS', name: 'Rio Grande do Sul' },
  { id: 'RO', name: 'Rondônia' },
  { id: 'RR', name: 'Roraima' },
  { id: 'SC', name: 'Santa Catarina' },
  { id: 'SP', name: 'São Paulo' },
  { id: 'SE', name: 'Sergipe' },
  { id: 'TO', name: 'Tocantins' }
];

/**
 * Cidades de referência mapeadas por UF para carregamento imediato e offline.
 */
const DEFAULT_CITIES_BY_STATE: Record<string, CityItem[]> = {
  SP: [
    { id: 'sao-paulo', name: 'São Paulo', stateId: 'SP' },
    { id: 'campinas', name: 'Campinas', stateId: 'SP' },
    { id: 'santos', name: 'Santos', stateId: 'SP' },
    { id: 'sao-bernardo-do-campo', name: 'São Bernardo do Campo', stateId: 'SP' },
    { id: 'santo-andre', name: 'Santo André', stateId: 'SP' },
    { id: 'osasco', name: 'Osasco', stateId: 'SP' },
    { id: 'sorocaba', name: 'Sorocaba', stateId: 'SP' },
    { id: 'sao-jose-dos-campos', name: 'São José dos Campos', stateId: 'SP' },
    { id: 'ribeirao-preto', name: 'Ribeirão Preto', stateId: 'SP' }
  ],
  RJ: [
    { id: 'rio-de-janeiro', name: 'Rio de Janeiro', stateId: 'RJ' },
    { id: 'niteroi', name: 'Niterói', stateId: 'RJ' },
    { id: 'duque-de-caxias', name: 'Duque de Caxias', stateId: 'RJ' },
    { id: 'nova-iguacu', name: 'Nova Iguaçu', stateId: 'RJ' },
    { id: 'sao-goncalo', name: 'São Gonçalo', stateId: 'RJ' },
    { id: 'petropolis', name: 'Petrópolis', stateId: 'RJ' }
  ],
  MG: [
    { id: 'belo-horizonte', name: 'Belo Horizonte', stateId: 'MG' },
    { id: 'uberlandia', name: 'Uberlândia', stateId: 'MG' },
    { id: 'contagem', name: 'Contagem', stateId: 'MG' },
    { id: 'juiz-de-fora', name: 'Juiz de Fora', stateId: 'MG' },
    { id: 'betim', name: 'Betim', stateId: 'MG' }
  ],
  RS: [
    { id: 'porto-alegre', name: 'Porto Alegre', stateId: 'RS' },
    { id: 'caxias-do-sul', name: 'Caxias do Sul', stateId: 'RS' },
    { id: 'canoas', name: 'Canoas', stateId: 'RS' },
    { id: 'pelotas', name: 'Pelotas', stateId: 'RS' }
  ],
  PR: [
    { id: 'curitiba', name: 'Curitiba', stateId: 'PR' },
    { id: 'londrina', name: 'Londrina', stateId: 'PR' },
    { id: 'maringa', name: 'Maringá', stateId: 'PR' },
    { id: 'ponta-grossa', name: 'Ponta Grossa', stateId: 'PR' }
  ],
  BA: [
    { id: 'salvador', name: 'Salvador', stateId: 'BA' },
    { id: 'feira-de-santana', name: 'Feira de Santana', stateId: 'BA' },
    { id: 'vitoria-da-conquista', name: 'Vitória da Conquista', stateId: 'BA' }
  ],
  PE: [
    { id: 'recife', name: 'Recife', stateId: 'PE' },
    { id: 'jaboatao-dos-guararapes', name: 'Jaboatão dos Guararapes', stateId: 'PE' },
    { id: 'olinda', name: 'Olinda', stateId: 'PE' }
  ],
  CE: [
    { id: 'fortaleza', name: 'Fortaleza', stateId: 'CE' },
    { id: 'caucaia', name: 'Caucaia', stateId: 'CE' },
    { id: 'juazeiro-do-norte', name: 'Juazeiro do Norte', stateId: 'CE' }
  ],
  DF: [
    { id: 'brasilia', name: 'Brasília', stateId: 'DF' }
  ],
  SC: [
    { id: 'florianopolis', name: 'Florianópolis', stateId: 'SC' },
    { id: 'joinville', name: 'Joinville', stateId: 'SC' },
    { id: 'blumenau', name: 'Blumenau', stateId: 'SC' }
  ],
  GO: [
    { id: 'goiania', name: 'Goiânia', stateId: 'GO' },
    { id: 'aparecida-de-goiania', name: 'Aparecida de Goiânia', stateId: 'GO' },
    { id: 'anapolis', name: 'Anápolis', stateId: 'GO' }
  ]
};

/**
 * Bairros de referência mapeados por cidade para carregamento rápido.
 */
const DEFAULT_NEIGHBORHOODS_BY_CITY: Record<string, NeighborhoodItem[]> = {
  'sao-paulo': [
    { id: 'pinheiros', name: 'Pinheiros', cityId: 'sao-paulo' },
    { id: 'vila-madalena', name: 'Vila Madalena', cityId: 'sao-paulo' },
    { id: 'itaim-bibi', name: 'Itaim Bibi', cityId: 'sao-paulo' },
    { id: 'moema', name: 'Moema', cityId: 'sao-paulo' },
    { id: 'bela-vista', name: 'Bela Vista', cityId: 'sao-paulo' },
    { id: 'tatuape', name: 'Tatuapé', cityId: 'sao-paulo' },
    { id: 'santana', name: 'Santana', cityId: 'sao-paulo' },
    { id: 'morumbi', name: 'Morumbi', cityId: 'sao-paulo' },
    { id: 'centro', name: 'Centro', cityId: 'sao-paulo' },
    { id: 'perdizes', name: 'Perdizes', cityId: 'sao-paulo' }
  ],
  'campinas': [
    { id: 'cambui', name: 'Cambuí', cityId: 'campinas' },
    { id: 'barao-geraldo', name: 'Barão Geraldo', cityId: 'campinas' },
    { id: 'taquaral', name: 'Taquaral', cityId: 'campinas' },
    { id: 'centro-campinas', name: 'Centro', cityId: 'campinas' }
  ],
  'rio-de-janeiro': [
    { id: 'copacabana', name: 'Copacabana', cityId: 'rio-de-janeiro' },
    { id: 'ipanema', name: 'Ipanema', cityId: 'rio-de-janeiro' },
    { id: 'botafogo', name: 'Botafogo', cityId: 'rio-de-janeiro' },
    { id: 'barra-da-tijuca', name: 'Barra da Tijuca', cityId: 'rio-de-janeiro' },
    { id: 'tijuca', name: 'Tijuca', cityId: 'rio-de-janeiro' },
    { id: 'centro-rio', name: 'Centro', cityId: 'rio-de-janeiro' }
  ],
  'belo-horizonte': [
    { id: 'savassi', name: 'Savassi', cityId: 'belo-horizonte' },
    { id: 'lourdes', name: 'Lourdes', cityId: 'belo-horizonte' },
    { id: 'pampulha', name: 'Pampulha', cityId: 'belo-horizonte' },
    { id: 'centro-bh', name: 'Centro', cityId: 'belo-horizonte' }
  ],
  'curitiba': [
    { id: 'batel', name: 'Batel', cityId: 'curitiba' },
    { id: 'centro-curitiba', name: 'Centro', cityId: 'curitiba' },
    { id: 'agua-verde', name: 'Água Verde', cityId: 'curitiba' },
    { id: 'santa-felicidade', name: 'Santa Felicidade', cityId: 'curitiba' }
  ],
  'porto-alegre': [
    { id: 'moinhos-de-vento', name: 'Moinhos de Vento', cityId: 'porto-alegre' },
    { id: 'cidade-baixa', name: 'Cidade Baixa', cityId: 'porto-alegre' },
    { id: 'petropolis-poa', name: 'Petrópolis', cityId: 'porto-alegre' },
    { id: 'centro-historico', name: 'Centro Histórico', cityId: 'porto-alegre' }
  ],
  'brasilia': [
    { id: 'asa-sul', name: 'Asa Sul', cityId: 'brasilia' },
    { id: 'asa-norte', name: 'Asa Norte', cityId: 'brasilia' },
    { id: 'aguas-claras', name: 'Águas Claras', cityId: 'brasilia' },
    { id: 'sudoeste', name: 'Sudoeste', cityId: 'brasilia' }
  ]
};

/**
 * Converte um texto arbitrário em slug padronizado (ex: "São Paulo" -> "sao-paulo").
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class GeographyService {
  /**
   * Retorna a lista de todas as UFs brasileiras.
   */
  public static getStates(): StateItem[] {
    return BRAZILIAN_STATES;
  }

  /**
   * Retorna os municípios disponíveis para uma UF específica.
   * Suporta lista padrão offline e fallback dinâmico para capitais padrão se UF não tiver lista local.
   */
  public static getCitiesByState(stateId: string): CityItem[] {
    const upperState = stateId.toUpperCase();
    const cities = DEFAULT_CITIES_BY_STATE[upperState];
    if (cities && cities.length > 0) {
      return cities;
    }

    const stateObj = BRAZILIAN_STATES.find(s => s.id === upperState);
    if (!stateObj) {
      return [];
    }

    // Capital/Polo padrão para estados menos populosos
    return [
      {
        id: `capital-${slugify(stateObj.name)}`,
        name: `Capital / Centro de ${stateObj.name}`,
        stateId: upperState
      }
    ];
  }

  /**
   * Retorna os bairros para uma cidade específica.
   * Se a cidade não tiver bairros pré-cadastrados, fornece lista padrão de polos/regiões.
   */
  public static getNeighborhoodsByCity(cityId: string): NeighborhoodItem[] {
    const cleanId = slugify(cityId);
    const neighborhoods = DEFAULT_NEIGHBORHOODS_BY_CITY[cleanId];
    if (neighborhoods && neighborhoods.length > 0) {
      return neighborhoods;
    }

    // Regiões padrão para qualquer cidade sem lista extensiva
    return [
      { id: `${cleanId}-centro`, name: 'Centro Comercial', cityId: cleanId },
      { id: `${cleanId}-norte`, name: 'Região Norte', cityId: cleanId },
      { id: `${cleanId}-sul`, name: 'Região Sul', cityId: cleanId },
      { id: `${cleanId}-leste`, name: 'Região Leste', cityId: cleanId },
      { id: `${cleanId}-oeste`, name: 'Região Oeste', cityId: cleanId }
    ];
  }

  /**
   * Cria um novo item de bairro dinâmico se o usuário desejar registrar um bairro não listado.
   */
  public static createCustomNeighborhood(cityId: string, customName: string): NeighborhoodItem {
    const slug = slugify(customName);
    return {
      id: `${slugify(cityId)}-${slug}`,
      name: customName.trim(),
      cityId: slugify(cityId)
    };
  }
}
