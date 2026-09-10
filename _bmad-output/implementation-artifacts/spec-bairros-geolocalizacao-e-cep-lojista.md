---
title: 'Múltiplos Bairros de Atuação, Geolocalização e Autocompletar de CEP do Lojista'
type: 'feature'
created: '2026-09-10'
status: 'done'
baseline_commit: '8bc58b24c9b9fcff0f175b1638fa765084c6ce3f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entregadores ficam limitados a visualizar apenas seu bairro residencial único ou precisam desativar totalmente o filtro hiperlocal; usuários precisam navegar manualmente por dropdowns para selecionar estado, cidade e bairro mesmo quando o dispositivo suporta geolocalização; e lojistas enfrentam atrito ao digitar manualmente endereço completo sem autocompletar por CEP, sem transição imediata para o número predial e sem suporte a complemento.

**Approach:** Implementar array de bairros de atuação (`operating_neighborhoods`) para entregadores mantendo o bairro fixo físico para lojas; disponibilizar serviço de geolocalização com geocodificação reversa para autoseleção regional no PWA; e integrar serviço de consulta de CEP (ViaCEP com fallback BrasilAPI), focando automaticamente no campo número e persistindo `postal_code` e `address_complement` no perfil do lojista.

## Boundaries & Constraints

**Always:**
- O endereço e localização de estabelecimentos comerciais continuam estritamente vinculados a um único bairro (`store_profiles.neighborhood_id`), correspondente ao endereço físico onde a loja opera e de onde saem os pedidos.
- O bairro residencial base do entregador (`courier_profiles.home_neighborhood_id`) permanece preservado como a âncora de quórum territorial para cálculo de ativação no `region_unlocks`.
- O CEP deve ser validado e formatado estritamente no padrão brasileiro (`00000-000` ou `8 dígitos numéricos`).
- A geolocalização via browser (`navigator.geolocation`) deve respeitar consentimento explícito, falhando graciosamente sem bloquear a seleção manual caso a permissão seja negada ou indisponível.

**Ask First:**
- Modificações estruturais que alterem a fórmula ou os contadores existentes da tabela `region_unlocks`.

**Never:**
- Permitir múltiplos bairros físicos de sede para um mesmo perfil de lojista.
- Fazer chamadas bloqueantes ou síncronas que travem a renderização da interface durante consultas ao ViaCEP ou de geolocalização.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CEP Válido com Retorno Completo | CEP "01310-100" digitado no form de Lojista | Preenche Logradouro, Bairro (Bela Vista), Cidade (São Paulo) e UF (SP); move foco para o campo "Número" | N/A |
| CEP Inexistente ou Inválido | CEP "99999-999" digitado | Notifica "CEP não encontrado. Preencha o endereço manualmente"; mantém campos editáveis | Mantém formulário aberto para preenchimento manual |
| Falha de Rede no ViaCEP | ViaCEP indisponível (timeout > 3s) | Aciona fallback automático para BrasilAPI; se ambos falharem, permite preenchimento manual sem travar UI | Captura exceção com toast informativo |
| Geolocalização Concedida | Usuário clica "Usar minha localização" (-23.561, -46.655) | Detecta São Paulo/SP, bairro Bela Vista e sincroniza estado/cidade/bairro no formulário/feed | Notificação visual de sucesso com dados detectados |
| Geolocalização Negada/Indisponível | Usuário recusa permissão de GPS | Exibe feedback sutil "Permissão de localização não concedida"; preserva seleção manual intacta | Feedback inline sem interromper o fluxo |
| Entregador com Múltiplos Bairros | Entregador seleciona ["pinheiros", "vila-madalena"] | Salva array em `courier_profiles.operating_neighborhoods`; `listOpenJobs` retorna vagas de ambos os bairros | Se vazio, adota `[home_neighborhood_id]` como padrão |
| Consulta de Vagas com Filtro Múltiplo | `listOpenJobs({ neighborhood_ids: ['pinheiros', 'perdizes'] })` | Retorna vagas com `neighborhood_id IN ('pinheiros', 'perdizes')` respeitando modal e horários | Array vazio retorna lista vazia ou sem filtro conforme especificado |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260910100000_multi_neighborhoods_and_store_address.sql` -- DDL: colunas `postal_code` e `address_complement` em `store_profiles`, `operating_neighborhoods` em `courier_profiles` com índice GIN
- `apps/pwa/src/geography/cep-service.ts` -- Serviço de consulta e validação de CEP via ViaCEP + BrasilAPI com timeout e fallback
- `apps/pwa/src/geography/geolocation-service.ts` -- Serviço de detecção de coordenadas e geocodificação reversa integrada à árvore de `geography-service.ts`
- `apps/pwa/src/geography/geography-service.ts` -- Helpers geográficos e mapeamento de coordenadas/nomes
- `apps/pwa/src/profile/profile-service.ts` -- DTOs e funções `completeStoreProfile`, `updateStoreProfile`, `completeCourierProfile`, `updateCourierProfile` com os novos campos
- `apps/pwa/src/jobs/job-service.ts` -- Suporte a `neighborhood_ids: string[]` em `listOpenJobs`
- `apps/pwa/src/components/profile/ProfileCompletionForm.tsx` -- Autocompletar CEP, foco no número, complemento e múltiplos bairros
- `apps/pwa/src/components/profile/ProfileEditModal.tsx` -- Suporte a CEP, foco no número, complemento e múltiplos bairros na edição
- `apps/pwa/src/components/jobs/JobFeed.tsx` -- Filtro dinâmico por múltiplos bairros de atuação
- `tests/cep-lookup-and-store-address.test.js` -- Testes unitários para CEP, preenchimento e schema da loja
- `tests/geolocation-region-detection.test.js` -- Testes para detecção de geolocalização e fallback
- `tests/multi-neighborhood-selection.test.js` -- Testes para múltiplos bairros no perfil do entregador e listagem de vagas

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260910100000_multi_neighborhoods_and_store_address.sql` -- Adicionar `postal_code` e `address_complement` em `store_profiles`, e `operating_neighborhoods` em `courier_profiles` -- Expansão do modelo relacional no Postgres
- [x] `apps/pwa/src/geography/cep-service.ts` -- Criar serviço de busca de CEP com suporte a ViaCEP e BrasilAPI -- Automação de endereçamento para lojistas
- [x] `apps/pwa/src/geography/geolocation-service.ts` -- Criar serviço de geolocalização do navegador e geocodificação reversa com mapeamento para `geography-service.ts` -- Identificação automática de região
- [x] `apps/pwa/src/profile/profile-service.ts` -- Atualizar DTOs e persistência para CEP, complemento e múltiplos bairros -- Integração backend
- [x] `apps/pwa/src/jobs/job-service.ts` -- Adicionar suporte a `neighborhood_ids: string[]` em `listOpenJobs` -- Filtragem de vagas para múltiplos bairros
- [x] `apps/pwa/src/components/profile/ProfileCompletionForm.tsx` -- Integrar busca por CEP, foco no campo número, campo de complemento e múltiplos bairros para entregadores -- Experiência de primeiro cadastro
- [x] `apps/pwa/src/components/profile/ProfileEditModal.tsx` -- Integrar busca por CEP, foco no número, complemento e múltiplos bairros na edição de perfil -- Gestão contínua de perfil
- [x] `apps/pwa/src/components/jobs/JobFeed.tsx` -- Atualizar filtros para considerar os múltiplos bairros de atuação do entregador -- Visualização ergonômica de oportunidades
- [x] `tests/cep-lookup-and-store-address.test.js` -- Testes de CEP, fallback de API e integridade dos dados da loja
- [x] `tests/geolocation-region-detection.test.js` -- Testes de geolocalização e tratamento de permissões
- [x] `tests/multi-neighborhood-selection.test.js` -- Testes de múltiplos bairros e filtragem de vagas

**Acceptance Criteria:**
- Given um lojista digitando um CEP válido de 8 dígitos, when a busca for resolvida, then Rua, Bairro, Cidade e UF são preenchidos automaticamente e o foco é transferido para o input de Número.
- Given um lojista cadastrando seu endereço, when preencher o número e complemento opcional, then os dados são salvos nas colunas `address_number`, `address_complement` e `postal_code`.
- Given um usuário com localização habilitada no navegador, when acionar a detecção de região, then a UF, Cidade e Bairro mais próximos/correspondentes são identificados e selecionados automaticamente.
- Given um entregador configurando seus bairros, when selecionar mais de um bairro de atuação, then o array de bairros é salvo em `operating_neighborhoods` e a consulta `listOpenJobs` inclui vagas de todos os bairros selecionados.
- Given um lojista publicando vagas ou cadastrando sua loja, when informar o bairro, then o bairro de atuação das vagas da loja é unicamente o bairro de sua sede física.

## Design Notes

- O foco no input de número é acionado via `useRef<HTMLInputElement>` após a resolução do promise do CEP com pequeno delay (`setTimeout(..., 50)`) para garantir a renderização dos campos preenchidos.
- A geolocalização possui fallback defensivo: caso o reverse-geocoding remoto não responda ou falhe, o serviço identifica por proximidade de coordenadas geográficas euclidianas a capital/cidade brasileira mais próxima cadastrada no sistema.

## Verification

**Commands:**
- `npm test` -- expected: Todos os testes do monorepo passam (282 existentes + novas suites)
