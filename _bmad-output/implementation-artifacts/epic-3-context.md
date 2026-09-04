# Epic 3 Context: Balizador Inteligente de Preços Regionais e Proteção Anti-Manipulação

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Oferecer transparência de mercado para entregadores e lojistas através de um balizador analítico regional inteligente que calcula a mediana ($P_{med}$), valores mínimos ($P_{min}$) e máximos ($P_{max}$) praticados para diárias e taxas de entrega por bairro/cidade. O balizador é protegido estatisticamente por um algoritmo de expurgo de outliers ($1.5\times\text{IQR}$) contra distorções e fraudes, conta com travas de velocidade tarifária ($\pm 30\%$ a cada 12 horas) no perfil dos usuários e disponibiliza os indicadores em alta performance (< 100ms) para PWA, Landing Pages e integrações externas.

## Stories

- **Story 3.1:** Algoritmo de Expulgo de Outliers via Filtro $1.5\times\text{IQR}$ no Banco de Dados
- **Story 3.2:** Endpoint de Analytics de Preços com Cache e Alta Performance
- **Story 3.3:** Trava de Velocidade Tarifária no Perfil do Usuário (Anti-Manipulação)
- **Story 3.4:** Painel Visual do Balizador Regional no PWA e Landing Pages

## Requirements & Constraints

- **FR-7 (Cálculo Estatístico de Preços):** Cálculo dinâmico de $P_{min}$, $P_{med}$ (mediana / 50º percentil) e $P_{max}$ para diárias (`daily_rate`) e taxas por entrega (`delivery_fee`) por combinação geográfica `(state_id, city_id, neighborhood_id)`.
- **FR-8 (Expurgo de Outliers $1.5 \times \text{IQR}$):** Janela móvel de transações concluídas (`status: completed`) dos últimos 14 dias. Cálculo de quartis $Q_1$ (25º percentil), $Q_3$ (75º percentil), $\text{IQR} = Q_3 - Q_1$, e limites de corte $[\max(0, Q_1 - 1.5 \times \text{IQR}), Q_3 + 1.5 \times \text{IQR}]$. Valores fora desse intervalo são expurgados da agregação final.
- **Fallback de Bairros em Consolidação:** Se um bairro tiver menos de 10 transações concluídas na janela de 14 dias, o balizador deve usar como fallback os dados consolidados do município (`city_id`) com flag indicadora de consolidação (`is_consolidated: false`).
- **FR-9 (Trava de Velocidade Tarifária):** Alterações de diária ou taxa base no perfil de entregadores ou lojistas limitadas a no máximo $\pm 30\%$ em uma janela móvel de 12 horas (controlado pelo campo `rate_updated_at`), prevenindo cartelização artificial e dumping predatório.
- **NFR-3 (Latência de Analytics):** Tempo de resposta do endpoint analítico $< 100\text{ms}$ com estratégia de caching e materialização/índices otimizados.
- **NFR-9 (Usabilidade Touch & Mobile):** Widgets visuais de mercado com alvos de toque $\ge 48\text{px}$, suporte a Dark/Light mode e preenchimento de preços em 1 toque ("Sugerir Preço de Mercado").

## Technical Decisions

- **Persistência Analítica no Supabase/PostgreSQL:**
  - Tabela ou View Materializada `regional_pricing_metrics` agregando estatísticas por `(state_id, city_id, neighborhood_id)` e por modal de transporte.
  - Função analítica em PL/pgSQL com funções de janela (`percentile_cont(0.25)`, `percentile_cont(0.50)`, `percentile_cont(0.75)`) para cálculo exato de quartis e IQR sobre `job_posts` e `job_bids` casados/concluídos.
- **Trava de Velocidade:**
  - Validação no serviço `ProfileService` e trigger/constraint no PostgreSQL verificando `rate_updated_at` antes de autorizar novas tarifas bases em `courier_profiles`.
- **Arquitetura Hexagonal:**
  - `pricing-service.ts` como porta de domínio orquestrando consultas analíticas, expurgo estatístico e sugestão de valores em tempo real.

## UX & Interaction Patterns

- Exibição de chips de preços sugeridos no formulário de publicação de vagas com botão "[Sugerir Preço de Mercado]".
- Visualização de histograma ou range bar (mínimo, mediana, máximo) no feed do PWA e Landing Page com cores contextuais (verde para condições atrativas, neutro para medianas de mercado).
- Alerta visual amigável quando o usuário tentar alterar tarifas acima da trava de velocidade de 30% em 12 horas, indicando o valor máximo e mínimo permitido e o tempo restante.

## Cross-Story Dependencies

- O **Epic 3** consome os dados transacionais de vagas concluídas e propostas aceitas do **Epic 2** (`job_posts` e `job_bids`), e os perfis geográficos do **Epic 1** (`region_unlocks`, `store_profiles`, `courier_profiles`).
- **Story 3.1** provê a fundação estatística (IQR) para o endpoint da **Story 3.2** e para o painel visual da **Story 3.4**.
- **Story 3.3** aprimora os perfis criados no Epic 1 protegendo a plataforma contra oscilações manipulativas de preços.
