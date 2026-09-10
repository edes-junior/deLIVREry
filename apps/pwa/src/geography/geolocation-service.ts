/**
 * @file geolocation-service.ts
 * @description Serviço de geolocalização do navegador e mapeamento territorial
 * com geocodificação reversa e fallback por proximidade geográfica.
 */

import { GeographyService, BRAZILIAN_STATES, slugify } from './geography-service.ts';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DetectedRegion {
  stateId: string;
  cityId: string;
  neighborhoodId: string;
  neighborhoodName: string;
  cityName?: string;
  stateName?: string;
  formattedLabel: string;
  latitude: number;
  longitude: number;
}

// Coordenadas centrais aproximadas de capitais e grandes polos brasileiros para fallback offline
const REFERENCE_COORDINATES: Array<{
  stateId: string;
  cityId: string;
  cityName: string;
  neighborhoodId: string;
  neighborhoodName: string;
  lat: number;
  lon: number;
}> = [
  { stateId: 'SP', cityId: 'sao-paulo', cityName: 'São Paulo', neighborhoodId: 'sao-paulo-centro', neighborhoodName: 'Centro', lat: -23.5505, lon: -46.6333 },
  { stateId: 'SP', cityId: 'campinas', cityName: 'Campinas', neighborhoodId: 'campinas-centro', neighborhoodName: 'Centro', lat: -22.9099, lon: -47.0626 },
  { stateId: 'RJ', cityId: 'rio-de-janeiro', cityName: 'Rio de Janeiro', neighborhoodId: 'rio-de-janeiro-centro', neighborhoodName: 'Centro', lat: -22.9068, lon: -43.1729 },
  { stateId: 'MG', cityId: 'belo-horizonte', cityName: 'Belo Horizonte', neighborhoodId: 'belo-horizonte-centro', neighborhoodName: 'Centro', lat: -19.9167, lon: -43.9345 },
  { stateId: 'PR', cityId: 'curitiba', cityName: 'Curitiba', neighborhoodId: 'curitiba-centro', neighborhoodName: 'Centro', lat: -25.4284, lon: -49.2733 },
  { stateId: 'RS', cityId: 'porto-alegre', cityName: 'Porto Alegre', neighborhoodId: 'porto-alegre-centro', neighborhoodName: 'Centro', lat: -30.0346, lon: -51.2177 },
  { stateId: 'BA', cityId: 'salvador', cityName: 'Salvador', neighborhoodId: 'salvador-centro', neighborhoodName: 'Centro', lat: -12.9777, lon: -38.5016 },
  { stateId: 'DF', cityId: 'brasilia', cityName: 'Brasília', neighborhoodId: 'brasilia-centro', neighborhoodName: 'Plano Piloto', lat: -15.7975, lon: -47.8919 },
  { stateId: 'PE', cityId: 'recife', cityName: 'Recife', neighborhoodId: 'recife-centro', neighborhoodName: 'Centro', lat: -8.0476, lon: -34.8770 },
  { stateId: 'CE', cityId: 'fortaleza', cityName: 'Fortaleza', neighborhoodId: 'fortaleza-centro', neighborhoodName: 'Centro', lat: -3.7319, lon: -38.5267 }
];

/**
 * Calcula distância euclidiana aproximada (adequada para seleção do polo mais próximo).
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

export class GeolocationService {
  /**
   * Obtém as coordenadas geográficas atuais do usuário através do navegador.
   */
  public static async getCurrentPosition(
    options?: PositionOptions,
    nav: any = typeof navigator !== 'undefined' ? navigator : undefined
  ): Promise<Coordinates> {
    if (!nav || !nav.geolocation) {
      throw new Error('Geolocalização não é suportada neste navegador ou ambiente.');
    }

    return new Promise((resolve, reject) => {
      nav.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          let message = 'Não foi possível obter a sua localização.';
          if (error.code === 1) { // PERMISSION_DENIED
            message = 'Permissão de localização negada pelo usuário.';
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            message = 'Sinal de localização GPS indisponível.';
          } else if (error.code === 3) { // TIMEOUT
            message = 'Tempo limite esgotado ao buscar localização.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
          ...options
        }
      );
    });
  }

  /**
   * Identifica a região (UF, Cidade, Bairro) a partir das coordenadas latitude/longitude.
   * Utiliza geocodificação reversa (Nominatim / OSM) com fallback para os polos de referência.
   */
  public static async detectRegionFromCoordinates(
    latitude: number,
    longitude: number,
    timeoutMs = 4000
  ): Promise<DetectedRegion> {
    // 1. Tentativa de Geocodificação Reversa Online
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'deLIVREry-PWA/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const address = data?.address;
        if (address) {
          // UF
          const rawState = address.state || address['ISO3166-2-lvl4']?.split('-')[1] || '';
          let stateObj = BRAZILIAN_STATES.find(
            (s) => s.id.toUpperCase() === rawState.toUpperCase() || s.name.toLowerCase() === rawState.toLowerCase()
          );
          if (!stateObj && address['ISO3166-2-lvl4']) {
            const ufCode = address['ISO3166-2-lvl4'].replace('BR-', '');
            stateObj = BRAZILIAN_STATES.find((s) => s.id === ufCode);
          }
          const stateId = stateObj ? stateObj.id : 'SP';

          // Cidade
          const rawCity = address.city || address.town || address.municipality || address.village || 'São Paulo';
          const citySlug = slugify(rawCity);
          const citiesInState = GeographyService.getCitiesByState(stateId);
          const matchedCity = citiesInState.find((c) => slugify(c.name) === citySlug || c.id === citySlug);
          const cityId = matchedCity ? matchedCity.id : citySlug;
          const cityName = matchedCity ? matchedCity.name : rawCity;

          // Bairro
          const rawNeighborhood =
            address.suburb ||
            address.neighbourhood ||
            address.city_district ||
            address.residential ||
            address.quarter ||
            'Centro';
          const neighborhoodSlug = slugify(rawNeighborhood);
          const neighborhoodsInCity = GeographyService.getNeighborhoodsByCity(cityId);
          const matchedNeighborhood = neighborhoodsInCity.find(
            (n) => slugify(n.name) === neighborhoodSlug || n.id.includes(neighborhoodSlug)
          );

          const finalNeighborhoodId = matchedNeighborhood
            ? matchedNeighborhood.id
            : `${cityId}-${neighborhoodSlug}`;
          const finalNeighborhoodName = matchedNeighborhood
            ? matchedNeighborhood.name
            : rawNeighborhood;

          return {
            stateId,
            cityId,
            neighborhoodId: finalNeighborhoodId,
            neighborhoodName: finalNeighborhoodName,
            cityName,
            stateName: stateObj?.name || stateId,
            formattedLabel: `${finalNeighborhoodName}, ${cityName} - ${stateId}`,
            latitude,
            longitude
          };
        }
      }
    } catch {
      // Fallback em caso de erro de rede ou timeout
    }

    // 2. Fallback Inteligente: Encontra o polo de referência mais próximo
    let closest = REFERENCE_COORDINATES[0];
    let minDistance = Infinity;

    for (const ref of REFERENCE_COORDINATES) {
      const dist = calculateDistance(latitude, longitude, ref.lat, ref.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = ref;
      }
    }

    const stateObj = BRAZILIAN_STATES.find((s) => s.id === closest.stateId);

    return {
      stateId: closest.stateId,
      cityId: closest.cityId,
      neighborhoodId: closest.neighborhoodId,
      neighborhoodName: closest.neighborhoodName,
      cityName: closest.cityName,
      stateName: stateObj?.name || closest.stateId,
      formattedLabel: `${closest.neighborhoodName}, ${closest.cityName} - ${closest.stateId}`,
      latitude,
      longitude
    };
  }
}
