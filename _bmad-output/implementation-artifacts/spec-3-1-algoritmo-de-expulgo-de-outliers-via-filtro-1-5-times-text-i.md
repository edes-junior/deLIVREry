---
title: 'Story 3.1: Algoritmo de Expulgo de Outliers via Filtro 1.5xIQR no Banco de Dados'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '3ddf7a9133791354b0e7741e46771b259630eca0'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Em mercados descentralizados sem intermediários, valores anômalos inseridos por erro de digitação ou tentativas de manipulação predatória (cartel ou dumping) podem inflacionar ou derrubar artificialmente as referências de preço do bairro, gerando desconfiança e inviabilizando a cooperação comunitária.

**Approach:** Implementar a rotina estatística analítica no PostgreSQL (Supabase) e na camada de domínio da aplicação que calcula os quartis ($Q_1, Q_3$), o intervalo interquartil ($\text{IQR} = Q_3 - Q_1$) e aplica o corte $[\max(0, Q_1 - 1.5 \times \text{IQR}), Q_3 + 1.5 \times \text{IQR}]$ para expurgar outliers antes de consolidar a mediana regional ($P_{med}$), valores mínimos e máximos da diária e taxa de entrega nos últimos 14 dias, com fallback transparente para a cidade caso o bairro possua amostra insuficiente (< 10 transações).

## Boundaries & Constraints

**Always:**
- Janela temporal padrão de 14 dias para cálculo das métricas (`window_days = 14`).
- Base de cálculo restrita a transações concluídas ou ativamente casadas (`status IN ('matched', 'completed')`).
- Cálculo estatístico oficial de corte de Tukey: $[\max(0, Q_1 - 1.5 \times \text{IQR}), Q_3 + 1.5 \times \text{IQR}]$.
- Fallback automático e transparente para a cidade (`city_id`) quando a contagem de amostras no bairro for inferior a 10 transações (`sample_size < 10`), sinalizado com `is_consolidated = false`.
- Toda tabela analítica criada deve possuir Row Level Security (RLS) habilitado com política de leitura pública universal e escrita restrita (`service_role` ou funções `SECURITY DEFINER`).
- Convenção de integridade e nomenclatura padrão do monorepo: `snake_case`, UUIDv4, timestamps UTC com `TIMESTAMPTZ`.

**Ask First:**
- Alterar a janela temporal móvel padrão de 14 dias para períodos menores que 7 dias ou maiores que 30 dias.
- Modificar o multiplicador de corte estatístico ($1.5 \times \text{IQR}$).

**Never:**
- Nunca permitir que valores de diária ou taxa de entrega expurgados influenciem os valores de $P_{min}$, $P_{med}$ e $P_{max}$.
- Nunca travar ou bloquear a execução de matching se o balizador analítico estiver momentaneamente indisponível (tolerância a falhas).
- Nunca retornar valores negativos para preços mínimos ($P_{min} \ge 0$).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Amostra Consistente no Bairro | Bairro com $\ge 10$ turnos casados/concluídos em 14 dias sem outliers | Métricas calculadas com $Q_1, P_{med}, Q_3, P_{min}, P_{max}$, `is_consolidated = true` | N/A |
| Amostra com Outliers Extremos | Amostra com diárias normais (R$ 100-140) e outlier aberrante (R$ 1.000 ou R$ 1) | Outlier detectado fora de $[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$ e expurgado; $P_{med}$ e limites preservados | Outlier é removido da amostra sem lançar exceção |
| Amostra Insuficiente no Bairro (< 10) | Bairro novo com 3 turnos concluídos | Balizador aciona fallback automático para o município (`city_id`) com `is_consolidated = false` | Exibe indicador amigável de dados em consolidação |
| Município sem Histórico Transacional | Cidade recém-cadastrada sem nenhuma transação prévia | Retorna balizador de referência base (tarifas dos perfis ou padrão regional) com `sample_size = 0` | Fallback neutro sem quebra |
| Disparidade por Modal de Transporte | Consulta com filtro de modal específico (ex: `bicycle` vs `motorcycle`) | Filtra transações apenas do modal especificado para cálculo isolado | Se modal não tiver amostra, agrega todos os modais da região |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904210000_regional_pricing_iqr_analytics.sql` -- Tabela `public.regional_pricing_metrics`, índices e função PL/pgSQL analítica `calculate_regional_pricing_iqr` com percentis e corte $1.5\times\text{IQR}$.
- `apps/pwa/src/pricing/types.ts` -- Modelos TypeScript das métricas do balizador regional (`RegionalPricingMetrics`), parâmetros de consulta e enums estatísticos.
- `apps/pwa/src/pricing/pricing-service.ts` -- Camada de domínio (Hexagonal) para cálculo puro de IQR (`calculateIQR`), expurgo de outliers, consulta de balizador e cache.
- `tests/pricing-iqr-analytics.test.js` -- Suíte de testes automatizados cobrindo algoritmo Módulo IQR de Tukey, expurgo de outliers, fallback de consolidação e integridade de migration DDL.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904210000_regional_pricing_iqr_analytics.sql` -- Criar migration com tabela `regional_pricing_metrics`, RLS de leitura pública e função SQL de agregação por quartis e IQR.
- [x] `apps/pwa/src/pricing/types.ts` -- Definir interfaces tipadas para métricas de preços, quartis, limites e resultados consolidados.
- [x] `apps/pwa/src/pricing/pricing-service.ts` -- Implementar funções puras de IQR (`calculateIQR`, `filterOutliers`), método de consulta regional e fallback para cidades com menos de 10 amostras.
- [x] `tests/pricing-iqr-analytics.test.js` -- Implementar suíte completa de testes automatizados com Node.js test runner validando todas as regras estatísticas de FR-7 e FR-8.

**Acceptance Criteria:**
- Given uma amostra com valores discrepantes, when o algoritmo de IQR for executado, then valores além de $1.5 \times \text{IQR}$ devem ser expurgados da amostra final.
- Given um bairro com menos de 10 transações concluídas em 14 dias, when a consulta for disparada, then o sistema deve aplicar o fallback para a cidade com a flag `is_consolidated = false`.
- Given o cálculo de quartis e mediana, when os dados forem processados, then $P_{min}$ nunca deve ser inferior a 0 e $P_{med}$ deve refletir o percentil 50 contínuo.

## Design Notes

- **Algoritmo de Tukey ($1.5 \times \text{IQR}$)**:
  - $Q_1 = \text{percentile}(0.25)$
  - $Q_2 = P_{med} = \text{percentile}(0.50)$
  - $Q_3 = \text{percentile}(0.75)$
  - $\text{IQR} = Q_3 - Q_1$
  - $\text{Lower Bound} = \max(0, Q_1 - 1.5 \times \text{IQR})$
  - $\text{Upper Bound} = Q_3 + 1.5 \times \text{IQR}$
- **Janela Móvel:** Amostras filtradas com `created_at >= now() - interval '14 days'`.
- **Desempenho (NFR-3):** Persistência dos valores agregados em `regional_pricing_metrics` com índices compostos em `(state_id, city_id, neighborhood_id)`.

## Verification

**Commands:**
- `npm test` -- expected: Suíte de testes `pricing-iqr-analytics.test.js` e demais testes passando com 100% de sucesso.
- `git status` -- expected: Arquivos rastreados na branch `feat/story-3-1-outlier-iqr-filter`.
