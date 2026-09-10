/**
 * @file tests/geolocation-region-detection.test.js
 * @description Testes automatizados para serviço de geolocalização e detecção de região territorial.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GeolocationService } from '../apps/pwa/src/geography/geolocation-service.ts';

describe('Feature: Identificação Territorial por Geolocalização', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Captura de Coordenadas do Navegador (getCurrentPosition)', () => {
    test('Cenário 1: Sucesso na obtenção das coordenadas com permissão concedida', async () => {
      const mockNav = {
        geolocation: {
          getCurrentPosition: (success) => {
            success({
              coords: {
                latitude: -23.5505,
                longitude: -46.6333
              }
            });
          }
        }
      };

      const pos = await GeolocationService.getCurrentPosition({}, mockNav);
      assert.equal(pos.latitude, -23.5505);
      assert.equal(pos.longitude, -46.6333);
    });

    test('Cenário 2: Erro de permissão negada pelo usuário (código 1)', async () => {
      const mockNav = {
        geolocation: {
          getCurrentPosition: (success, error) => {
            error({ code: 1, message: 'User denied geolocation' });
          }
        }
      };

      await assert.rejects(
        () => GeolocationService.getCurrentPosition({}, mockNav),
        /Permissão de localização negada pelo usuário/
      );
    });

    test('Cenário 3: Ambiente sem suporte a geolocalização', async () => {
      const mockNav = {};

      await assert.rejects(
        () => GeolocationService.getCurrentPosition({}, mockNav),
        /Geolocalização não é suportada/
      );
    });
  });

  describe('Detecção de Região via Coordenadas (detectRegionFromCoordinates)', () => {
    test('Cenário 4: Geocodificação reversa online via Nominatim mapeia UF, Cidade e Bairro', async () => {
      globalThis.fetch = async (url) => {
        assert.ok(url.includes('nominatim.openstreetmap.org'));
        return {
          ok: true,
          json: async () => ({
            address: {
              suburb: 'Pinheiros',
              city: 'São Paulo',
              state: 'São Paulo',
              'ISO3166-2-lvl4': 'BR-SP'
            }
          })
        };
      };

      const region = await GeolocationService.detectRegionFromCoordinates(-23.561, -46.685);
      assert.ok(region);
      assert.equal(region.stateId, 'SP');
      assert.equal(region.cityId, 'sao-paulo');
      assert.equal(region.neighborhoodId, 'pinheiros');
      assert.equal(region.neighborhoodName, 'Pinheiros');
      assert.match(region.formattedLabel, /Pinheiros, São Paulo - SP/);
    });

    test('Cenário 5: Falha na geocodificação online ativa fallback para o polo mais próximo', async () => {
      // Simula falha de conexão com a API externa
      globalThis.fetch = async () => {
        throw new Error('Network error');
      };

      // Coordenadas próximas do Rio de Janeiro (-22.90, -43.17)
      const region = await GeolocationService.detectRegionFromCoordinates(-22.91, -43.18);
      assert.ok(region);
      assert.equal(region.stateId, 'RJ');
      assert.equal(region.cityId, 'rio-de-janeiro');
      assert.equal(region.neighborhoodId, 'rio-de-janeiro-centro');
      assert.match(region.formattedLabel, /Rio de Janeiro - RJ/);
    });
  });
});
