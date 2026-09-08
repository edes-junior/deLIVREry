# Epic 2 Context: Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Permitir que lojistas publiquem turnos e vagas de emergência com valores ofertados e modais aceitos, e que entregadores compatíveis recebam notificações em tempo real, visualizem e negociem condições (Bid/Ask). Com o fechamento do matching com 1 clique, os contatos telefônicos diretos são mutuamente liberados para a operação sem intermediação ou custódia financeira, acumulando reputação e XP.

## Stories

- Story 2.1: Schema de Vagas e Propostas com RLS e Isolamento de Contatos
- Story 2.2: Publicação de Vagas de Turno e Notificações Web Push (FCM)
- Story 2.3: Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
- Story 2.4: Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP

## Requirements & Constraints

- **FR-4:** Publicação de turnos e vagas por lojistas com modais aceitos, horários e valores ofertados.
- **FR-5:** Notificações e listagem de vagas abertas com negociação Bid/Ask (aceite direto ou contraproposta).
- **FR-6:** Fechamento de matching com 1 clique, isolando contatos até o status `matched` e liberando telefones/nomes apenas para as partes envolvidas.
- **FR-14:** Gamificação com concessão de XP (+50 XP para postagem com antecedência > 48h; pontuação por conclusão de turno e penalidade por cancelamento tardio < 2h).
- **AD-2:** Zero custódia financeira (P2P): pagamento direto lojista-motoboy via PIX/dinheiro sem taxas ou intermediação bancária.
- **AD-6:** Zero custo operacional de comunicação: Web Push (FCM gratuito), Realtime WebSocket do Supabase e In-App notification.
- **NFR-2:** Latência de notificação Web Push < 3s.
- **NFR-9:** Alvos de toque touch-friendly ≥ 48px com haptic feedback (vibração tátil).

## Technical Decisions

- **AD-10:** Row Level Security (RLS) estrito em `job_posts` e `job_bids`: dados públicos de vagas abertas acessíveis para busca; telefones e propostas concorrentes protegidos. Telefones e nomes só expostos reciprocamente após `status = 'matched'`.
- **Estrutura de Dados:**
  - `job_posts`: `id`, `store_id`, `shift_start_time`, `shift_end_time`, `offered_daily_rate`, `offered_delivery_fee`, `accepted_modals`, `neighborhood_id`, `city_id`, `state_id`, `status` (`open`, `matched`, `in_progress`, `completed`, `cancelled`), `matched_bid_id`, `matched_courier_id`, `created_at`, `updated_at`.
  - `job_bids`: `id`, `job_id`, `courier_id`, `bid_daily_rate`, `bid_delivery_fee`, `status` (`pending`, `accepted`, `rejected`, `cancelled`), `created_at`, `updated_at`.
- **Integridade & Performance:** Chaves estrangeiras e índices em `city_id`, `neighborhood_id`, `store_id`, `courier_id`, `status`.
- **Convenções:** UUIDv4 gerados via `gen_random_uuid()`, nomenclatura em `snake_case`, `TIMESTAMPTZ` em UTC para datas.

## UX & Interaction Patterns

- Feed dinâmico de vagas filtradas por modal e raio operacional (bicicletas ≤ 3km; veículos motorizados para raios maiores).
- Botões touch-friendly (≥ 48px) para aceite direto e contraproposta rápida com haptic feedback (vibração tátil).
- Liberação visual e imediata de dados de contato (WhatsApp / Telefone com link `tel:` e `https://wa.me/...`) no card da vaga assim que o status transicionar para `matched`.

## Cross-Story Dependencies

- Depende do schema de usuários (`users`), perfis (`store_profiles`, `courier_profiles`) e localidades (`region_unlocks`) entregues no Epic 1.
- Fornece a base de transações e valores de diária/entrega para o Balizador de Preços Regional (Epic 3).
