---
stepsCompleted:
  - 1
  - 2
  - 3
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-deLIVREry-2026-08-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-deLIVREry-2026-08-21/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-deLIVREry-2026-08-21/ARCHITECTURE-SPINE.md
---

# deLIVREry - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for deLIVREry, decomposing the requirements from the PRD, Architecture Spine, and Addendum into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR-1: Autenticação Passwordless de Usuários Finais** — O sistema deve permitir login e criação de conta de Entregadores e Lojistas via Magic Link enviado por e-mail, mantendo a sessão persistente no Supabase Auth com suporte a IndexedDB/LocalStorage. Se o e-mail não estiver cadastrado, direciona para complementação cadastral.
- **FR-2: Validação Rigorosa e Cobertura Geográfica Universal** — O sistema deve validar os dígitos verificadores de CPF, formato de e-mail e telefone celular com DDD em qualquer Estado e Município do Brasil, impedindo duplicidade no banco de dados. Suporte dinâmico à árvore de Estados (UF), Cidades (`city_id`) e Bairros (`neighborhood_id`).
- **FR-3: Gestão e Emissão de Chaves de API para Parceiros (API Keys)** — O sistema deve permitir que desenvolvedores e parceiros integradores gerem credenciais de API (`client_id` e `api_key`) com restrição de escopo geográfico (`allowed_cities`). Retorna 401 para chave inválida e 403 para cidade não autorizada.
- **FR-4: Publicação de Vaga / Turno de Trabalho** — Lojistas autenticados podem publicar vagas de entrega especificando data/hora do turno, valor base da diária ofertada, taxa fixa por entrega e modal aceito na sua região. A vaga assume status `open` e emite notificações Web Push (FCM) em `< 3s` para entregadores compatíveis da localidade. Publicações com mais de 48h de antecedência creditam `+50 XP`.
- **FR-5: Envio e Aceite de Proposta / Contraproposta (Bid/Ask)** — Entregadores podem aceitar a vaga pelo valor anunciado ou submeter contraproposta de diária/taxa. O lojista pode aceitar a contraproposta com 1 clique, consolidando o matching e fechando a vaga (`status: matched`). Contrapropostas concorrentes são rejeitadas automaticamente (`status: rejected`). Contatos telefônicos e identificação mútua são liberados. Cancelamento com `< 2h` do início deduz `50 XP`.
- **FR-6: Filtro e Compatibilidade por Modal de Transporte** — O sistema deve direcionar vagas exclusivamente para entregadores cujos modais cadastrados sejam compatíveis com o raio e perfil da loja (ex: ciclistas apenas para chamadas $\le 3\text{km}$; vagas $> 5\text{km}$ não exibidas para bicicletas convencionais).
- **FR-7: Cálculo Dinâmico de $P_{min}, P_{med}, P_{max}$ Regional** — O sistema deve calcular periodicamente a mediana, valor mínimo e valor máximo praticados para cada par `city_id` e `neighborhood_id`, expondo os dados no PWA e via endpoint `/api/v1/analytics/pricing-stats` com latência `< 100ms`.
- **FR-8: Expulgo de Outliers via Filtro 1.5×IQR** — O motor analítico deve eliminar do cálculo público de preços qualquer valor fora do intervalo $[Q_1 - 1.5 \times \text{IQR}, Q_3 + 1.5 \times \text{IQR}]$, impedindo distorção artificial de $P_{med}$ por ofertas fraudulentas ou anômalas.
- **FR-9: Trava de Velocidade Tarifária (Rate Limiting de Preços)** — O sistema deve bloquear alterações no valor base padrão do perfil do entregador ou lojista que excedam $\pm 30\%$ em uma janela móvel de 12 horas (retornando `400 Bad Request` se violado).
- **FR-10: Disparo do Modal de Microdoação nos 5 Delight Moments** — O sistema deve acionar o componente de doação voluntária (Bottom Sheet / Modal não-bloqueante) nos 5 momentos mapeados: 1. Entregador após confirmação de pagamento; 2. Entregador ao subir de nível; 3. Lojista com vaga de emergência aceita em $<5\text{min}$; 4. Lojista avaliando entregador com 5 estrelas; 5. Parceiro API ao atingir 1.000 requisições de sucesso no mês. Exibe chips `[ R$ 2,00 ]`, `[ R$ 5,00 ]`, `[ R$ 10,00 ]`, `[ Outro Valor ]` e `[ Agora Não ]`.
- **FR-11: Chave PIX Estática Mockada e Cópia em 1 Clique** — Ao clicar em copiar, o sistema injeta o payload BR Code da Chave PIX Estática configurada na área de transferência com vibração tátil (*Haptic Feedback*) e toast. Registra o evento anonimamente em `donations_log` e concede `+25 XP` e badge *Apoiador da Comunidade* no primeiro apoio do mês.
- **FR-12: Painel Público de Transparência do Custo do Servidor** — O sistema deve disponibilizar um indicador público de arrecadação comunitária vs. custo real mensal de infraestrutura (Supabase, FCM, hospedagem), exibindo banner de *Vitória Coletiva* ao atingir 100% da meta.
- **FR-13: Termômetro de Desbloqueio Universal** — O sistema deve rastrear o número de lojistas e entregadores cadastrados em cada micro-região brasileira. Regiões com menos de 10 lojas e 50 entregadores operam em status `pre_launch`, exibindo a barra de progresso no PWA e nas Landing Pages. Ao atingir o quórum, desbloqueia automaticamente (`is_unlocked = true`) com disparo de Web Push e Webhooks.
- **FR-14: Motor de XP e Níveis de Gamificação** — O sistema deve conceder pontos de XP e elevar o nível dos usuários (Bronze, Prata, Ouro) conforme tabela de ações (Concluir turno: `+50 XP`; Publicar vaga `>48h`: `+50 XP`; Avaliação 5 estrelas: `+20 XP`; Indicação qualificada: `+100 XP`). Níveis superiores ganham destaque visual no balizador e listagens.
- **FR-15: Link Exclusivo de Indicação Viral (`referral_code`)** — Cada entregador e lojista possui link exclusivo de indicação. Cadastros originados desse link contabilizam pontos diretos de avanço no termômetro do bairro do indicador e preenchem automaticamente o código no formulário.
- **FR-16: Endpoints de Gestão Headless de Vagas e Perfis** — A API deve expor rotas RESTful para cadastro (`POST /api/v1/couriers`, `POST /api/v1/stores`), listagem georreferenciada (`GET /api/v1/jobs?city_id=...`) e matching (`POST /api/v1/bids/:id/accept`), em conformidade com OpenAPI 3.0.
- **FR-17: Disparo de Webhooks de Saída Assinados** — O sistema deve disparar notificações HTTP POST em tempo real para URLs de parceiros para os eventos `job.created`, `bid.submitted`, `job.accepted` e `job.completed`, contendo cabeçalho `X-Signature-SHA256` calculado via HMAC-SHA256 e retentativas com backoff exponencial para erros 5xx.
- **FR-18: Componente Web Embutível (`<delivrery-button />`)** — O projeto deve disponibilizar um Web Component nativo em JavaScript puro (Custom Elements v1, sem frameworks externos) com renderização `< 50ms` para acionamento de entregadores a partir de cardápios digitais e portais.

### NonFunctional Requirements

- **NFR-1: Desempenho de Autenticação** — Envio e processamento de Magic Link com tempo de resposta $< 2\text{s}$.
- **NFR-2: Desempenho de Push Notifications** — Notificações Web Push (FCM) entregues em $< 3\text{s}$ para entregadores compatíveis no bairro/cidade.
- **NFR-3: Latência de Analytics de Preços** — Consultas de agregação e estatísticas regionais IQR via endpoint com tempo de resposta $< 100\text{ms}$.
- **NFR-4: Leveza e Desempenho do Web Component** — `<delivrery-button />` com renderização $< 50\text{ms}$ e zero dependências externas em tempo de execução.
- **NFR-5: Isolamento e Segurança de Dados (RLS)** — Row Level Security (RLS) mandatório em 100% das tabelas do PostgreSQL; contatos e dados sensíveis só visíveis após matching confirmado (`status: matched`).
- **NFR-6: Integridade Criptográfica de Webhooks** — Todos os disparos de webhook autenticados via assinatura HMAC-SHA256 no header `X-Signature-SHA256`.
- **NFR-7: Rate Limiting e Tratamento de Erros Padronizado** — Controle de taxa por tier de cliente (PWA: burst 300/10s; Parceiro Free: 120 RPM; Enterprise/Municipal: 600 RPM) e respostas de erro estruturadas em RFC 7807 Problem Details.
- **NFR-8: Frugalidade e Custo Operacional Zero** — Infraestrutura baseada em tiers gratuitos (Supabase Serverless PostgreSQL/Auth/Edge Functions, FCM Web Push, Vite Static Hosting), operando sem intermediação financeira ou custódia de valores.
- **NFR-9: Usabilidade Mobile-First e Acessibilidade** — Alvos de toque com no mínimo 48px, feedback tátil (vibração haptic) em ações críticas e compatibilidade com navegadores modernos em dispositivos móveis presos ao guidão.
- **NFR-10: Resiliência de Webhooks** — Até 3 retentativas automáticas com backoff exponencial para falhas de rede ou erros 5xx em integrações de parceiros.

### Additional Requirements

- **Estrutura de Monorepo / Starter Template** — Projeto estruturado com:
  - `supabase/` (migrations SQL versionadas, RLS e Edge Functions Deno: `pricing-stats`, `webhook-dispatch`, `fcm-notify`);
  - `apps/landing-pages/` (Landing Pages A/B/C universais em React + Vite);
  - `apps/pwa/` (PWA oficial de referência mobile-first para lojistas e motoboys em React + Vite);
  - `apps/developer-portal/` (Portal do Desenvolvedor com documentação OpenAPI 3.0 / Swagger UI);
  - `packages/embed-widget/` (Web Component Vanilla JS `<delivrery-button />`);
  - `packages/api-client-sdk/` (SDK TypeScript/JS neutro para clientes e integradores).
- **Esquema de Banco de Dados Relacional e RLS** — Tabelas canônicas: `api_clients`, `webhooks_subscriptions`, `users`, `courier_profiles`, `store_profiles`, `job_posts`, `job_bids`, `region_unlocks`, `donations_log`, todas com RLS e triggers de auditoria.
- **Configuração de Ambiente PIX Estático** — Suporte a variáveis de ambiente (`PUBLIC_PIX_KEY`, `PUBLIC_PIX_RECIPIENT_NAME`, `PUBLIC_PIX_CITY`, `PUBLIC_PIX_BRCODE_PAYLOAD`).
- **Triggers Reativos de Banco (Event-Driven)** — PostgreSQL triggers disparando eventos assíncronos via Edge Functions / pg_net para push notifications, webhooks e atualização de estatísticas.

### UX Design Requirements

*Nenhum documento de design de UX formal foi encontrado no repositório; os requisitos de usabilidade, tokens visuais, alvos de 48px e fluxos de tela foram extraídos diretamente do PRD e Architecture Spine.*

### FR Coverage Map

- **FR-1:** Epic 1 — Autenticação Passwordless de Usuários Finais (Magic Link)
- **FR-2:** Epic 1 — Validação Rigorosa e Cobertura Geográfica Universal (CPF/UF/Cidade/Bairro)
- **FR-3:** Epic 5 — Gestão e Emissão de Chaves de API para Parceiros (API Keys & Allowed Cities)
- **FR-4:** Epic 2 — Publicação de Vaga / Turno de Trabalho e Notificações Web Push (FCM)
- **FR-5:** Epic 2 — Envio e Aceite de Proposta / Contraproposta (Bid/Ask) e Matching P2P
- **FR-6:** Epic 2 — Filtro e Compatibilidade por Modal de Transporte (Moto, Bike, E-Bike)
- **FR-7:** Epic 3 — Cálculo Dinâmico de $P_{min}, P_{med}, P_{max}$ Regional via Analytics
- **FR-8:** Epic 3 — Expulgo de Outliers via Algoritmo Estatístico $1.5\times\text{IQR}$
- **FR-9:** Epic 3 — Trava de Velocidade Tarifária (Rate Limiting $\pm 30\%$ em 12h)
- **FR-10:** Epic 4 — Disparo do Modal de Microdoação nos 5 Delight Moments Mapeados
- **FR-11:** Epic 4 — Chave PIX Estática Mockada, Cópia em 1 Clique e Haptic Feedback
- **FR-12:** Epic 4 — Painel Público de Transparência do Custo do Servidor vs. Arrecadação
- **FR-13:** Epic 1 — Termômetro de Desbloqueio Universal e Quórum Hiperlocal (10 Lojas / 50 Motoboys)
- **FR-14:** Epic 2 — Motor de XP e Níveis de Gamificação (Bronze, Prata, Ouro)
- **FR-15:** Epic 1 — Link Exclusivo de Indicação Viral (`referral_code`)
- **FR-16:** Epic 5 — Endpoints RESTful de Gestão Headless de Vagas e Perfis (OpenAPI 3.0)
- **FR-17:** Epic 5 — Disparo de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)
- **FR-18:** Epic 5 — Componente Web Embutível Leve (`<delivrery-button />`)

## Epic List

### Epic 1: Onboarding Universal, Identidade e Ativação Regional
Entregadores e lojistas de qualquer município do Brasil podem autenticar-se sem senhas via Magic Link, cadastrar e validar seus perfis com dados de contato e modal, selecionar sua localização na árvore geográfica nacional, acompanhar o termômetro de quórum do seu bairro e compartilhar seu link de indicação viral para acelerar o desbloqueio operacional da sua região.
**FRs covered:** FR-1, FR-2, FR-13, FR-15.

### Epic 2: Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
Lojistas podem publicar turnos e vagas de emergência com valores ofertados e modais aceitos; entregadores compatíveis recebem alertas Web Push em tempo real, visualizam vagas abertas no PWA, aceitam ou submetem contrapropostas (Bid/Ask); lojistas fecham o matching com 1 clique, liberando contatos telefônicos diretos para a execução do turno e acumulando pontos de XP e reputação.
**FRs covered:** FR-4, FR-5, FR-6, FR-14.

### Epic 3: Balizador Inteligente de Preços Regionais e Proteção Anti-Manipulação
Entregadores e lojistas contam com um painel analítico de transparência que exibe a mediana ($P_{med}$), valores mínimos e máximos da diária e taxa por entrega em seu bairro, protegido estatisticamente por algoritmo de expurgo de outliers ($1.5\times\text{IQR}$) e travas de velocidade tarifária contra manipulações artificiais de mercado.
**FRs covered:** FR-7, FR-8, FR-9.

### Epic 4: Sustentabilidade Comunitária por Microdoações PIX em Delight Moments
Usuários e integradores apoiam financeiramente a manutenção dos servidores da plataforma através de microdoações voluntárias via Chave PIX Estática Copia e Cola (com feedback tátil e BR Code), acionadas estrategicamente nos 5 momentos de alívio e alta satisfação operacional (*Delight Moments*), com acompanhamento coletivo no Painel de Transparência de Custos.
**FRs covered:** FR-10, FR-11, FR-12.

### Epic 5: Plataforma Headless, Developer Portal e Webhooks de Integração
Desenvolvedores de PDVs, cardápios digitais e portais municipais podem emitir API Keys delimitadas por escopo geográfico, explorar a documentação OpenAPI/Swagger interativa, gerenciar vagas e entregadores via API RESTful padronizada, receber notificações de eventos em tempo real via Webhooks assinados com HMAC-SHA256 e embutir o botão de despacho `<delivrery-button />` com 1 tag HTML.
**FRs covered:** FR-3, FR-16, FR-17, FR-18.

---

## Epic 1: Onboarding Universal, Identidade e Ativação Regional

Entregadores e lojistas de qualquer município do Brasil podem autenticar-se sem senhas via Magic Link, cadastrar e validar seus perfis com dados de contato e modal, selecionar sua localização na árvore geográfica nacional, acompanhar o termômetro de quórum do seu bairro e compartilhar seu link de indicação viral para acelerar o desbloqueio operacional da sua região.

### Story 1.1: Inicialização do Monorepo e Schema de Identidade & Geografia com RLS

As a Desenvolvedor da plataforma deLIVREry,
I want a estrutura de monorepo configurada (`apps/pwa`, `apps/landing-pages`, `apps/developer-portal`, `supabase/`, `packages/`) e o schema inicial de banco de dados (`users`, `courier_profiles`, `store_profiles`, `region_unlocks`) com Row Level Security (RLS) ativo,
So that tenhamos uma base arquitetural padronizada, segura e desacoplada para suportar a expansão nacional.

**Acceptance Criteria:**

**Given** um ambiente de desenvolvimento limpo com Node.js e Supabase CLI configurados
**When** o projeto for inicializado
**Then** a estrutura de monorepo deve conter os diretórios de aplicações e pacotes definidos no Architecture Spine
**And** as dependências essenciais de workspace devem ser instaladas sem conflitos.

**Given** a migration SQL de schema de usuários e regiões executada no PostgreSQL
**When** as tabelas `users`, `courier_profiles`, `store_profiles` e `region_unlocks` forem criadas
**Then** todas as tabelas devem possuir RLS habilitado, garantindo que usuários autenticados só leiam/escrevam em seus próprios registros
**And** as restrições de integridade (CPF único, e-mail único, checks de enum de modal e user_type) devem ser aplicadas.

**Given** a tabela `region_unlocks`
**When** consultada pela árvore `state_id`, `city_id` e `neighborhood_id`
**Then** deve retornar os contadores de quórum (`couriers_count`, `stores_count`) e o status `is_unlocked`.

### Story 1.2: Autenticação Passwordless via Magic Link com Sessão Persistente

As a Entregador ou Lojista,
I want realizar login ou cadastro apenas informando meu endereço de e-mail e clicando no link de acesso recebido,
So that eu acesse o sistema rapidamente sem digitar senhas complexas e mantenha minha sessão autenticada no PWA.

**Acceptance Criteria:**

**Given** um usuário na tela de autenticação do PWA ou Landing Page
**When** ele submeter um endereço de e-mail válido
**Then** o sistema deve disparar o Magic Link via Supabase Auth em tempo de resposta $< 2\text{s}$ (NFR-1) e exibir mensagem de confirmação de envio.

**Given** o usuário recebendo o link de autenticação em seu e-mail
**When** ele clica no link e abre a aplicação
**Then** o cliente PWA deve armazenar os tokens JWT de forma persistente (LocalStorage/IndexedDB) mantendo a sessão mesmo após fechar ou reiniciar o navegador.

**Given** um e-mail recém-autenticado que ainda não possui perfil complementar cadastrado
**When** a sessão for iniciada
**Then** a aplicação deve redirecionar o usuário automaticamente para o formulário de complementação de perfil.

### Story 1.3: Cadastro e Perfil Universal com Validação Rigorosa de CPF e Geografia Brasileira

As a Novo usuário autenticado (Entregador ou Lojista),
I want completar meu cadastro escolhendo meu tipo de conta, validando CPF e telefone com DDD, definindo meu modal de transporte (se motoboy) ou endereço/raio (se loja) e selecionando meu Estado/Cidade/Bairro,
So that meu perfil seja ativado sem duplicidade e vinculado à minha micro-região de atuação no Brasil.

**Acceptance Criteria:**

**Given** o formulário de complementação cadastral
**When** o usuário digitar um CPF com dígitos verificadores inválidos
**Then** o sistema deve rejeitar o envio com mensagem de erro amigável em PT-BR e impedir a persistência no banco.

**Given** a seleção de localização geográfica no cadastro
**When** o usuário selecionar seu Estado (UF)
**Then** o campo de Cidades deve carregar dinamicamente os municípios correspondentes, seguido pelos bairros cadastrados para aquela cidade.

**Given** um entregador completando o cadastro
**When** ele selecionar seu modal de transporte (`motorcycle`, `bicycle`, `ebike_scooter`), definir suas tarifas base iniciais e submeter o formulário
**Then** o registro deve ser gravado na tabela `courier_profiles` e um código exclusivo de indicação (`referral_code`) deve ser gerado automaticamente.

**Given** um lojista completando o cadastro
**When** ele informar a razão/nome fantasia da loja, endereço e coordenadas geográficas
**Then** o registro deve ser gravado na tabela `store_profiles` com pontuação inicial de reputação de 5.00.

### Story 1.4: Termômetro de Desbloqueio Regional e Mecânica de Indicação Viral

As a Usuário de um bairro em fase de pré-lançamento (`pre_launch`),
I want visualizar a barra de progresso de quórum do meu bairro e obter meu link exclusivo de indicação com 1 clique,
So that eu possa compartilhar com outros comerciantes e motoboys locais para atingirmos o quórum mínimo e desbloquear a operação.

**Acceptance Criteria:**

**Given** um bairro com menos de 10 lojas ativas ou menos de 50 entregadores cadastrados
**When** visualizado no PWA ou Landing Page
**Then** deve exibir o status `pre_launch` com a barra de progresso indicando o percentual de quórum atingido (ex: "7/10 lojas • 32/50 motoboys").

**Given** o usuário acessando a área de indicação ou o painel principal
**When** ele clicar no botão de copiar link de indicação
**Then** a URL formatada contendo seu `referral_code` deve ser copiada para o clipboard e um toast de sucesso exibido.

**Given** um novo usuário acessando a aplicação através de um link com `?ref=CODIGO`
**When** ele realizar seu cadastro na localidade
**Then** o indicador deve ter sua referência registrada e o contador de quórum do bairro deve ser incrementado em tempo real.

**Given** um bairro que atinja a marca de 10 lojas e 50 entregadores
**When** a transação de cadastro final for confirmada
**Then** o status da região deve transicionar automaticamente para `is_unlocked = true` com registro do timestamp `unlocked_at`.

---

## Epic 2: Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional

Lojistas podem publicar turnos e vagas de emergência com valores ofertados e modais aceitos; entregadores compatíveis recebem alertas Web Push em tempo real, visualizam vagas abertas no PWA, aceitam ou submetem contrapropostas (Bid/Ask); lojistas fecham o matching com 1 clique, liberando contatos telefônicos diretos para a execução do turno e acumulando pontos de XP e reputação.

### Story 2.1: Schema de Vagas e Propostas com RLS e Isolamento de Contatos

As a Desenvolvedor deLIVREry,
I want o schema de banco de dados para postagem de vagas (`job_posts`) e ofertas/contrapropostas (`job_bids`) protegido por Row Level Security (RLS),
So that propostas concorrentes fiquem isoladas e telefones/contatos diretos de lojistas e motoboys só fiquem acessíveis quando o matching for formalizado (`status = 'matched'`).

**Acceptance Criteria:**

**Given** a migration SQL de vagas e bids executada no Supabase PostgreSQL
**When** as tabelas `job_posts` e `job_bids` forem criadas
**Then** os campos de status (`open`, `matched`, `in_progress`, `completed`, `cancelled`) e checks numéricos de valores devem ser validados
**And** chaves estrangeiras com `store_profiles` e `courier_profiles` devem ser configuradas com índices de performance em `city_id` e `neighborhood_id`.

**Given** as políticas de RLS ativas em `job_posts` e `job_bids`
**When** um entregador consultar uma vaga com status `open`
**Then** ele poderá ler os dados públicos do turno (data/hora, valores ofertados, modal, bairro), mas não terá acesso ao telefone do lojista nem aos valores de bids concorrentes.

**Given** o aceite de uma proposta consolidando o status `matched`
**When** o lojista e o entregador vencedor consultarem o registro do turno
**Then** o sistema deve liberar reciprocamente o número de telefone e o nome completo para alinhamento operacional direto.

### Story 2.2: Publicação de Vagas de Turno e Notificações Web Push (FCM)

As a Lojista autenticado,
I want publicar um turno de trabalho especificando data/hora de início/fim, valor ofertado de diária, taxa por entrega e modais aceitos,
So that entregadores compatíveis do meu bairro/cidade recebam alertas Web Push em tempo real ($<3\text{s}$) e eu acumule $+50\text{ XP}$ ao publicar com antecedência ($>48\text{h}$).

**Acceptance Criteria:**

**Given** um lojista autenticado no PWA com perfil ativo
**When** ele preencher o formulário de nova vaga com horários válidos e valores de diária/taxa e submeter
**Then** a vaga deve ser persistida com status `open` e o lojista deve visualizar a confirmação no painel.

**Given** a publicação de uma vaga com mais de 48 horas de antecedência em relação ao início do turno
**When** a criação for confirmada
**Then** o sistema deve conceder automaticamente $+50\text{ XP}$ ao perfil do lojista.

**Given** a criação de uma nova vaga em um bairro ativo
**When** o trigger de banco for disparado
**Then** a Edge Function / Provedor FCM deve enviar notificações Web Push para os entregadores cadastrados naquele bairro/cidade e com modal compatível em latência $< 3\text{s}$ (NFR-2).

### Story 2.3: Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)

As a Entregador autônomo,
I want visualizar no PWA a lista de vagas abertas compatíveis com meu modal de transporte e aceitar o valor anunciado com 1 toque ou submeter uma contraproposta de diária e taxa,
So that eu possa negociar condições de trabalho justas e compatíveis com meu veículo e raio operacional.

**Acceptance Criteria:**

**Given** um entregador com modal cadastrado como bicicleta convencional
**When** ele abrir a listagem de vagas abertas
**Then** o sistema deve ocultar automaticamente vagas categorizadas como de longo alcance ($>5\text{km}$) e exibir apenas chamadas com raio $\le 3\text{km}$.

**Given** uma vaga aberta exibida no feed do PWA
**When** o entregador clicar no botão de aceite direto (alvo de toque $\ge 48\text{px}$)
**Then** o sistema deve emitir vibração tátil (haptic feedback) e registrar a proposta pelo valor integral anunciado.

**Given** o entregador optando por contrapropor valores
**When** ele informar um novo valor de diária e/ou taxa por entrega e submeter
**Then** o registro deve ser inserido em `job_bids` com status `pending` e o lojista notificado.

### Story 2.4: Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP

As a Lojista ou Entregador participante de um turno,
I want aceitar a proposta/contraproposta com 1 clique (rejeitando automaticamente concorrentes), visualizar os contatos telefônicos diretos e pontuar XP (ou sofrer penalidade em cancelamentos tardios com $<2\text{h}$),
So that o turno seja operacionalizado sem intermediários e com compromisso mútuo entre as partes.

**Acceptance Criteria:**

**Given** um lojista visualizando as propostas recebidas para sua vaga aberta
**When** ele clicar em [ Aceitar Proposta ]
**Then** a vaga deve transicionar para `status: matched`, a proposta selecionada para `status: accepted` e todas as demais contrapropostas para `status: rejected`.

**Given** a vaga no status `matched`
**When** lojista e entregador abrirem a tela de detalhes do turno
**Then** ambos devem ver o botão de chamada direta / WhatsApp com o número de telefone e nome do parceiro.

**Given** a conclusão do turno e confirmação mútua de pagamento direto P2P
**When** o lojista marcar o turno como concluído e avaliar o motoboy com 5 estrelas
**Then** o entregador recebe $+50\text{ XP}$ pela conclusão do turno e o lojista $+20\text{ XP}$ pela avaliação positiva.

**Given** um entregador ou lojista cancelando um turno acordado com menos de 2 horas para o início sem justificativa de força maior
**When** o cancelamento for processado
**Then** o sistema deve deduzir $50\text{ XP}$ do usuário cancelador e notificar a outra parte imediatamente.

---

## Epic 3: Balizador Inteligente de Preços Regionais e Proteção Anti-Manipulação

Entregadores e lojistas contam com um painel analítico de transparência que exibe a mediana ($P_{med}$), valores mínimos e máximos da diária e taxa por entrega em seu bairro, protegido estatisticamente por algoritmo de expurgo de outliers ($1.5\times\text{IQR}$) e travas de velocidade tarifária contra manipulações artificiais de mercado.

### Story 3.1: Algoritmo de Expulgo de Outliers via Filtro $1.5\times\text{IQR}$ no Banco de Dados

As a Desenvolvedor da plataforma deLIVREry,
I want uma rotina de agregação analítica no PostgreSQL / Edge Function que calcule os quartis ($Q_1, Q_3$), o intervalo interquartil ($\text{IQR}$) e expurgue ofertas anômalas antes de calcular as estatísticas,
So that propostas artificiais, fraudes ou erros grosseiros de digitação não distorçam a mediana regional de preços da comunidade.

**Acceptance Criteria:**

**Given** uma amostra de transações concluídas (`status: completed`) nos últimos 14 dias para um par `(city_id, neighborhood_id)`
**When** o algoritmo calcular $Q_1$ (25º percentil), $Q_3$ (75º percentil) e $\text{IQR} = Q_3 - Q_1$
**Then** os limites de corte devem ser definidos como $[\max(0, Q_1 - 1.5 \times \text{IQR}), Q_3 + 1.5 \times \text{IQR}]$
**And** as agregações estatísticas devem ser recalculadas apenas sobre a amostra limpa.

**Given** transações com valores anômalos (ex: diária de R$ 1.000,00 ou R$ 1,00 inserida intencionalmente)
**When** o cálculo estatístico for processado
**Then** esses valores devem ser expurgados da amostra, não alterando os valores finais de $P_{med}$, $P_{min}$ e $P_{max}$.

**Given** um bairro com menos de 10 transações concluídas na janela de 14 dias
**When** o balizador for consultado
**Then** deve retornar os valores médios consolidados da cidade (`city_id`) como fallback transparente com indicação de amostra em consolidação.

### Story 3.2: Endpoint de Analytics de Preços com Cache e Alta Performance

As a Cliente do ecossistema (PWA, PDVs ou Portais Municipais parceiros),
I want consultar o endpoint `GET /api/v1/analytics/pricing-stats?city_id=...&neighborhood_id=...` e obter as medianas e limites de preços em latência $<100\text{ms}$,
So that os parâmetros de mercado sejam carregados instantaneamente na interface sem onerar o banco.

**Acceptance Criteria:**

**Given** uma requisição HTTP `GET /api/v1/analytics/pricing-stats` com parâmetros de cidade e bairro válidos
**When** a Edge Function processar a consulta
**Then** deve responder em formato JSON contendo $P_{min}, P_{med}, P_{max}$ para diária e taxa por entrega, contagem de amostras computadas e timestamp da última agregação em tempo de resposta $< 100\text{ms}$ (NFR-3).

**Given** uma consulta sem parâmetros de localização geográfica
**When** a requisição for recebida
**Then** a API deve responder com erro padronizado RFC 7807 (`HTTP 400 Bad Request`) indicando a ausência dos parâmetros obrigatórios.

### Story 3.3: Trava de Velocidade Tarifária no Perfil do Usuário (Anti-Manipulação)

As a Usuário da rede deLIVREry,
I want que alterações no valor base padrão do perfil de entregadores e lojistas sejam limitadas a no máximo $\pm 30\%$ em uma janela móvel de 12 horas,
So that especulações predatórias de cartel ou dumping de preços sejam contidas na origem.

**Acceptance Criteria:**

**Given** um entregador ou lojista autenticado tentando atualizar sua diária ou taxa base no perfil
**When** o novo valor exceder a variação de $\pm 30\%$ em relação à tarifa configurada há menos de 12 horas (campo `rate_updated_at`)
**Then** o sistema deve rejeitar a alteração com erro `400 Bad Request` informando o teto e o piso permitidos para o período.

**Given** um usuário que realizou a última alteração de tarifa há mais de 12 horas
**When** ele submeter uma nova tarifa dentro dos limites da plataforma
**Then** o perfil deve ser atualizado com sucesso e o campo `rate_updated_at` atualizado para o timestamp atual.

### Story 3.4: Painel Visual do Balizador Regional no PWA e Landing Pages

As a Entregador ou Lojista navegando no PWA ou Landing Page,
I want visualizar o widget do Balizador Regional com $P_{min}, P_{med}, P_{max}$ de forma intuitiva,
So that eu tenha transparência sobre os valores praticados no meu bairro para calibrar minhas ofertas ou aceites de vagas.

**Acceptance Criteria:**

**Given** a tela de detalhes de vaga ou publicação no PWA
**When** a localização do bairro for selecionada
**Then** o componente visual do Balizador deve exibir a mediana ($P_{med}$) em destaque com chips de mínimo e máximo e indicador visual do modal correspondente.

**Given** um lojista criando uma vaga de emergência
**When** ele clicar no botão [ Sugerir Preço de Mercado ]
**Then** o formulário deve preencher automaticamente a diária e a taxa com os valores calculados de $P_{med}$ do bairro.

---

## Epic 4: Sustentabilidade e Autonomia Operacional por Contribuições Voluntárias PIX em Delight Moments

Usuários e integradores mantêm a operação integral, o suporte e o esforço contínuo de evolução do deLIVREry como ecossistema livre (Digital Commons) através de contribuições voluntárias diretas via Chave PIX Estática Copia e Cola (com feedback tátil e BR Code), acionadas estrategicamente nos 5 momentos de alívio e satisfação operacional (*Delight Moments*). A abordagem foca na preservação da liberdade contra monopólios (não em caridade), com objetivo visual de vitalidade operacional sem expor cifras monetárias e com isonomia radical entre os trabalhadores (sem selos ou contraprestações que configurem venda comercial/SaaS).

### Story 4.1: Schema de Logs de Microdoação (`donations_log`) e Configuração de Ambiente PIX

As a Desenvolvedor deLIVREry,
I want a tabela `donations_log` criada no Supabase e as variáveis de ambiente `PUBLIC_PIX_*` configuradas no cliente,
So that as intenções de doação sejam registradas anonimamente e as chaves PIX possam ser ajustadas sem recompilação de código.

**Acceptance Criteria:**

**Given** a migration SQL de doações executada no Supabase PostgreSQL
**When** a tabela `donations_log` for criada com campos `id`, `user_id` (opcional/anônimo), `trigger_moment`, `suggested_amount` e `copied_at`
**Then** ela deve possuir RLS habilitado permitindo inserção por usuários autenticados e anônimos.

**Given** as variáveis de ambiente `PUBLIC_PIX_KEY`, `PUBLIC_PIX_RECIPIENT_NAME`, `PUBLIC_PIX_CITY` e `PUBLIC_PIX_BRCODE_PAYLOAD` configuradas no arquivo `.env`
**When** o aplicativo for inicializado
**Then** esses valores devem estar disponíveis para injeção nos modais de Delight Moment.

### Story 4.2: Componente Bottom Sheet de Contribuição Operacional PIX com Haptic Feedback nos 5 Delight Moments

As a Entregador, Lojista ou Desenvolvedor de API em um momento de alívio ou celebração (*Delight Moment*),
I want visualizar o Bottom Sheet elegante e não-bloqueante com narrativa convincente de sustentação da operação e botão de cópia do BR Code com feedback tátil,
So that eu possa contribuir voluntariamente em menos de 10 segundos no meu app de banco sem interromper meu fluxo de trabalho e sem sensação de esmola ou caridade.

**Acceptance Criteria:**

**Given** um dos 5 momentos disparadores:
  1. Entregador após confirmação de pagamento integral do turno;
  2. Entregador ao subir de nível operacional (Bronze → Prata → Ouro);
  3. Lojista com vaga de emergência aceita em $<5\text{min}$;
  4. Lojista avaliando motoboy com 5 estrelas;
  5. Parceiro API atingindo 1.000 requisições mensais de sucesso
**When** o evento for disparado no PWA ou Portal
**Then** o Bottom Sheet deve surgir suavemente na tela com mensagem contextual convincente de copropriedade e sustentação da operação livre, com botão claro de saída `[ Agora Não ]` (sem contadores de bloqueio ou dark patterns).

**Given** o usuário clicando em [ 📋 Copiar Chave PIX ]
**When** a ação for executada
**Then** o payload BR Code da chave PIX estática deve ser copiado para a área de transferência do dispositivo com emissão de vibração tátil (*Haptic Feedback*) e toast de celebração fraterna.

**Given** o clique de cópia realizado
**When** a ação for confirmada
**Then** um registro anônimo deve ser inserido na tabela `donations_log` para cômputo de métricas de conversão.

### Story 4.3: Mensuração de Valor Retido e Gratidão Fraterna (Substituição de Badges por Conformidade Fiscal e Isonomia)

As a Entregador ou Lojista que utiliza a plataforma,
I want visualizar discretamente a economia real de taxas gerada pelo deLIVREry no meu período e receber uma mensagem transparente de gratidão ao apoiar,
So that eu compreenda o valor prático da ferramenta sem que o sistema crie castas de usuários ou incorra em riscos tributários de venda de serviços digitais (ISS).

**Acceptance Criteria:**

**Given** a decisão arquitetural e fiscal de manter o deLIVREry como Digital Commons imune a tributação de serviços
**When** um usuário apoiar financeiramente o projeto
**Then** o sistema NÃO deve conceder selos, badges ou pontuações de XP vinculadas ao pagamento (eliminando o risco de reclassificação da doação como venda de serviços/ativos digitais estilo Instagram Verified).

**Given** dois entregadores disputando uma vaga ou interagindo na plataforma
**When** seus perfis e cards forem visualizados
**Then** ambos devem possuir rigorosamente a mesma dignidade e visibilidade visual, sem qualquer diferenciação por capacidade contributiva (isonomia radical).

**Given** o fechamento do modal após a cópia da chave PIX
**When** a mensagem de confirmação for exibida
**Then** deve apresentar agradecimento fraterno e exibir estimativa do valor que permaneceu no bolso do trabalhador/lojista por não pagar taxas de intermediação.

### Story 4.4: Painel Público de Vitalidade e Sustentação Operacional da Praça (Sem Cifras Monetárias)

As a Membro da comunidade do deLIVREry,
I want visualizar um indicador visual de vitalidade e saúde operacional da praça sem exposição de valores em Reais (R$),
So that tenhamos clareza visual de objetivo sobre o fôlego da operação e visual comemorativo de *Vitória Coletiva* quando a comunidade garantir a sustentação plena do mês.

**Acceptance Criteria:**

**Given** o componente de sustentação no rodapé do PWA e Landing Pages
**When** renderizado
**Then** deve exibir o indicador visual de Vitalidade da Rede em faixas qualitativas (*Operação Básica* ➔ *Operação Saudável* ➔ *Evolução e Suporte Pleno*), sem expor cifras monetárias em Reais.

**Given** o atingimento de 100% da autonomia operacional estimada para o mês
**When** a página for carregada
**Then** o componente deve exibir o banner comemorativo de *Vitória Coletiva* destacando a autossuficiência e o esforço coletivo mantido pela própria comunidade.

---

## Epic 5: Plataforma Headless, Developer Portal e Webhooks de Integração

Desenvolvedores de PDVs, cardápios digitais e portais municipais podem emitir API Keys delimitadas por escopo geográfico, explorar a documentação OpenAPI/Swagger interativa, gerenciar vagas e entregadores via API RESTful padronizada, receber notificações de eventos em tempo real via Webhooks assinados com HMAC-SHA256 e embutir o botão de despacho `<delivrery-button />` com 1 tag HTML.

### Story 5.1: Schema de Clientes de API, Webhooks e Gateway de Validação

As a Desenvolvedor integrador B2B (Portal Municipal, PDV ou Cardápio Digital),
I want o schema de tenants de API (`api_clients`) e subscrições de webhook (`webhooks_subscriptions`) configurados no Supabase com validação de API Key (`X-API-Key`) e restrição de cidades autorizadas (`allowed_cities`),
So that o acesso de parceiros seja seguro, auditado e delimitado ao escopo geográfico autorizado.

**Acceptance Criteria:**

**Given** a migration SQL executada no Supabase PostgreSQL
**When** as tabelas `api_clients` e `webhooks_subscriptions` forem criadas com RLS
**Then** os campos `api_key_hash`, `allowed_cities`, `rate_limit_rpm` e `secret_token` devem ser persistidos com constraints de integridade.

**Given** uma requisição para a API REST sem o cabeçalho `X-API-Key` ou com uma chave inválida/revogada
**When** o gateway processar o cabeçalho
**Then** deve rejeitar a requisição com status `HTTP 401 Unauthorized`.

**Given** uma requisição válida de um parceiro autenticado tentando acessar dados de uma cidade fora do seu array `allowed_cities` (e diferente de `{"*"}`)
**When** o escopo for verificado
**Then** a API deve responder com status `HTTP 403 Forbidden`.

### Story 5.2: Endpoints RESTful Headless de Gestão de Vagas e Perfis (OpenAPI 3.0)

As a Desenvolvedor parceiro,
I want acessar endpoints RESTful padronizados (`POST /api/v1/couriers`, `POST /api/v1/stores`, `GET /api/v1/jobs?city_id=...`, `POST /api/v1/bids/:id/accept`),
So that eu possa gerenciar cadastros, turnos e despachos diretamente do meu sistema de PDV ou portal sem usar a interface do PWA.

**Acceptance Criteria:**

**Given** requisições enviadas para as rotas `/api/v1/*`
**When** os payloads forem válidos
**Then** as respostas devem retornar em formato JSON estritamente aderente à especificação OpenAPI 3.0.

**Given** ocorrência de erros de validação ou de negócio na API
**When** a resposta for gerada
**Then** ela deve seguir a padronização RFC 7807 Problem Details (campos `type`, `title`, `status`, `detail`).

**Given** um cliente excedendo o limite de requisições configurado (120 RPM para Free, 600 RPM para Enterprise/Municipal)
**When** o rate limit for atingido
**Then** o gateway deve responder com `HTTP 429 Too Many Requests` e cabeçalho `Retry-After`.

### Story 5.3: Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)

As a Sistema integrador parceiro,
I want receber notificações HTTP POST em tempo real com cabeçalho `X-Signature-SHA256` para eventos operacionais (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`) com retentativas automáticas,
So that meu sistema atualize o status dos pedidos instantaneamente com garantia criptográfica de autenticidade.

**Acceptance Criteria:**

**Given** a ocorrência de um evento de entrega no banco
**When** o dispatcher disparar a requisição POST para a `target_url` cadastrada pelo parceiro
**Then** a mensagem deve conter o cabeçalho `X-Signature-SHA256` calculado com o `secret_token` do integrador via algoritmo HMAC-SHA256 (NFR-6).

**Given** uma falha de conexão ou resposta `5xx` do endpoint do parceiro
**When** o erro for detectado
**Then** o dispatcher deve realizar até 3 retentativas automáticas utilizando backoff exponencial (NFR-10).

### Story 5.4: Portal do Desenvolvedor (`/developers`) com Swagger UI Interativo

As a Desenvolvedor integrador,
I want acessar o Portal do Desenvolvedor (`/developers`) para emitir minhas API Keys de teste/produção, cadastrar URLs de webhook e testar rotas no Swagger UI interativo,
So that minha jornada de integração técnica seja rápida, autônoma e autoexplicativa.

**Acceptance Criteria:**

**Given** um desenvolvedor acessando a aplicação `apps/developer-portal` na rota `/developers`
**When** ele solicitar a criação de credenciais
**Then** o sistema deve gerar `client_id`, `api_key` (exibida apenas uma vez) e `secret_token` para webhooks.

**Given** o playground interativo Swagger UI carregado com a especificação OpenAPI 3.0
**When** o desenvolvedor inserir sua API Key no botão [ Authorize ] e executar chamadas de teste
**Then** ele deve receber as respostas simuladas em tempo real com documentação completa dos schemas.

### Story 5.5: Web Component Embutível Nativo (`<delivrery-button />`) para Cardápios e PDVs

As a Desenvolvedor de cardápio digital ou portal web de prefeitura,
I want incluir a tag HTML `<delivrery-button city-id="..." store-id="..." />` com 1 script leve em Vanilla JavaScript sem frameworks pesados,
So that meus clientes lojistas possam acionar entregadores locais diretamente da tela do cardápio com tempo de renderização $< 50\text{ms}$.

**Acceptance Criteria:**

**Given** a inclusão da tag `<delivrery-button />` em qualquer página HTML ou framework externo
**When** o navegador carregar o script (`packages/embed-widget`)
**Then** o componente deve renderizar em $< 50\text{ms}$ (NFR-4) sem requerer nenhuma biblioteca ou dependência externa em runtime.

**Given** o lojista clicando no botão `<delivrery-button />`
**When** o clique for acionado
**Then** deve abrir a gaveta/modal interativa para envio de chamada de entregador à API do deLIVREry.





