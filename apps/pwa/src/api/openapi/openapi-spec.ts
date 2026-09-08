/**
 * Especificação OpenAPI 3.0 para a Headless API do deLIVREry
 * Em conformidade com FR-16, NFR-5, NFR-7 e RFC 7807 Problem Details.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'deLIVREry Headless API',
    description: 'API RESTful aberta para integração de sistemas de PDV, cardápios digitais e portais municipais com a logística descentralizada.',
    version: '1.0.0',
    contact: {
      name: 'Comunidade deLIVREry',
      url: 'https://delivrery.app.br'
    }
  },
  servers: [
    {
      url: 'https://api.delivrery.app.br',
      description: 'Ambiente de Produção'
    },
    {
      url: 'http://localhost:54321/functions/v1',
      description: 'Ambiente de Desenvolvimento Local (Supabase Edge)'
    }
  ],
  security: [
    {
      ApiKeyAuth: []
    }
  ],
  tags: [
    {
      name: 'Entregadores (Couriers)',
      description: 'Endpoints para cadastro e gestão descentralizada de profissionais de entrega.'
    },
    {
      name: 'Lojistas (Stores)',
      description: 'Endpoints para registro de estabelecimentos comerciais, endereços e coordenadas.'
    },
    {
      name: 'Vagas e Turnos (Jobs)',
      description: 'Consulta georreferenciada de oportunidades e turnos de entrega com balizador regional.'
    },
    {
      name: 'Matching e Propostas (Bids)',
      description: 'Operações de proposta tarifária bid-ask e fechamento de acordos operacionais.'
    }
  ],
  paths: {
    '/api/v1/couriers': {
      post: {
        tags: ['Entregadores (Couriers)'],
        summary: 'Cadastra um entregador (motoboy, ciclista ou e-bike) via API Headless',
        description: 'Permite que parceiros cadastrem profissionais de entrega vinculando-os ao tenant de origem (origin_client_id).',
        operationId: 'createCourier',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CourierRegistrationInput'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Perfil de entregador criado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CourierProfileResponse'
                }
              }
            }
          },
          '400': {
            description: 'Erro de validação cadastral (CPF, modal, tarifas ou geografia)',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '401': {
            description: 'API Key ausente ou inválida',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '403': {
            description: 'Município informado fora do escopo de cidades autorizadas',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '429': {
            description: 'Limite de requisições excedido',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/stores': {
      post: {
        tags: ['Lojistas (Stores)'],
        summary: 'Cadastra um estabelecimento lojista parceiro via API Headless',
        description: 'Permite que sistemas de PDV registrem lojas com coordenadas e localização para posterior publicação de turnos.',
        operationId: 'createStore',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StoreRegistrationInput'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Perfil de lojista criado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/StoreProfileResponse'
                }
              }
            }
          },
          '400': {
            description: 'Erro de validação cadastral',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '403': {
            description: 'Acesso negado para o município informado',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/jobs': {
      get: {
        tags: ['Vagas e Turnos (Jobs)'],
        summary: 'Lista vagas e turnos de entrega abertos por município',
        description: 'Retorna vagas com status open para o par city_id indicado, com suporte a filtros de bairro e modal de transporte.',
        operationId: 'getOpenJobs',
        parameters: [
          {
            name: 'city_id',
            in: 'query',
            required: true,
            description: 'Identificador do município (ex: sao_paulo, rio_de_janeiro)',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'neighborhood_id',
            in: 'query',
            required: false,
            description: 'Filtro opcional por bairro',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'transport_modal',
            in: 'query',
            required: false,
            description: 'Modal de transporte aceito (motorcycle, bicycle, ebike_scooter)',
            schema: {
              type: 'string',
              enum: ['motorcycle', 'bicycle', 'ebike_scooter', 'all']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Lista de vagas abertas retornada com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JobListResponse'
                }
              }
            }
          },
          '400': {
            description: 'Parâmetro city_id ausente ou inválido',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '403': {
            description: 'Acesso negado para a cidade pesquisada',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/bids/{id}/accept': {
      post: {
        tags: ['Matching e Propostas (Bids)'],
        summary: 'Aceita uma proposta de entregador e fecha o matching (Bid/Ask)',
        description: 'Atualiza o status da vaga para matched, vincula o entregador e rejeita propostas concorrentes.',
        operationId: 'acceptBid',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Identificador único da proposta (bid_id)',
            schema: {
              type: 'string'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['store_id', 'job_id', 'courier_id'],
                properties: {
                  store_id: { type: 'string', description: 'ID do lojista dono da vaga' },
                  job_id: { type: 'string', description: 'ID da vaga em negociação' },
                  courier_id: { type: 'string', description: 'ID do entregador da proposta aceita' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Matching concluído e vaga consolidada com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MatchedJobResponse'
                }
              }
            }
          },
          '400': {
            description: 'Parâmetros obrigatórios ausentes ou inconsistentes',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '404': {
            description: 'Proposta ou vaga não encontrada',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/problem+json': {
                schema: {
                  $ref: '#/components/schemas/ProblemDetails'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Chave de API gerada no portal de desenvolvedores (dlv_live_... ou dlv_test_...)'
      }
    },
    schemas: {
      ProblemDetails: {
        type: 'object',
        required: ['type', 'title', 'status', 'detail'],
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          instance: { type: 'string' },
          invalidParams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                reason: { type: 'string' }
              }
            }
          }
        }
      },
      CourierRegistrationInput: {
        type: 'object',
        required: ['fullName', 'cpf', 'phoneNumber', 'transportModal', 'baseDailyRate', 'baseDeliveryFee', 'stateId', 'cityId', 'homeNeighborhoodId'],
        properties: {
          userId: { type: 'string', description: 'ID opcional do usuário caso já autenticado' },
          fullName: { type: 'string' },
          cpf: { type: 'string', description: 'CPF válido com 11 dígitos' },
          phoneNumber: { type: 'string', description: 'Telefone celular brasileiro com DDD' },
          transportModal: { type: 'string', enum: ['motorcycle', 'bicycle', 'ebike_scooter'] },
          baseDailyRate: { type: 'number', minimum: 0 },
          baseDeliveryFee: { type: 'number', minimum: 0 },
          stateId: { type: 'string', maxLength: 2 },
          cityId: { type: 'string' },
          homeNeighborhoodId: { type: 'string' },
          referredByCode: { type: 'string' }
        }
      },
      CourierProfileResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          courier: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              fullName: { type: 'string' },
              transportModal: { type: 'string' },
              referralCode: { type: 'string' },
              level: { type: 'string' },
              xpPoints: { type: 'integer' },
              originClientId: { type: 'string' }
            }
          }
        }
      },
      StoreRegistrationInput: {
        type: 'object',
        required: ['storeName', 'fullName', 'cpf', 'phoneNumber', 'stateId', 'cityId', 'neighborhoodId'],
        properties: {
          userId: { type: 'string' },
          storeName: { type: 'string' },
          fullName: { type: 'string' },
          cpf: { type: 'string' },
          phoneNumber: { type: 'string' },
          addressStreet: { type: 'string' },
          addressNumber: { type: 'string' },
          stateId: { type: 'string', maxLength: 2 },
          cityId: { type: 'string' },
          neighborhoodId: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' }
        }
      },
      StoreProfileResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          store: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              storeName: { type: 'string' },
              reputationScore: { type: 'number' },
              originClientId: { type: 'string' }
            }
          }
        }
      },
      JobListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          total: { type: 'integer' },
          cityId: { type: 'string' },
          jobs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                storeId: { type: 'string' },
                cityId: { type: 'string' },
                neighborhoodId: { type: 'string' },
                shiftStartTime: { type: 'string', format: 'date-time' },
                shiftEndTime: { type: 'string', format: 'date-time' },
                offeredDailyRate: { type: 'number' },
                offeredDeliveryFee: { type: 'number' },
                acceptedModals: { type: 'array', items: { type: 'string' } },
                status: { type: 'string' }
              }
            }
          }
        }
      },
      MatchedJobResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          jobId: { type: 'string' },
          bidId: { type: 'string' },
          courierId: { type: 'string' },
          status: { type: 'string', example: 'matched' }
        }
      }
    }
  }
};

export default openApiSpec;
