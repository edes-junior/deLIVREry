# Epic 4 Context: Sustentabilidade Comunitária por Microdoações PIX em Delight Moments

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Garantir a soberania, perenidade e sustentabilidade financeira do ecossistema descentralizado deLIVREry através de um modelo de microdoações comunitárias voluntárias via PIX, acionadas estrategicamente em momentos de alta satisfação operacional (*Delight Moments*). A arrecadação é transparente, não possui intermediários ou taxas bancárias abusivas, e celebra publicamente as metas atingidas em um painel coletivo de custos de infraestrutura.

## Stories

- **Story 4.1:** Schema de Logs de Microdoação (`donations_log`) e Configuração de Ambiente PIX
- **Story 4.2:** Componente Bottom Sheet de Doação PIX com Haptic Feedback nos 5 Delight Moments
- **Story 4.3:** Concessão de Badge de Apoiador e Bonificação de XP
- **Story 4.4:** Painel Público de Transparência de Custos do Servidor e Vitória Coletiva

## Requirements & Constraints

- **FR-10 (Disparo nos 5 Delight Moments):** O componente de doação voluntária (Bottom Sheet / Modal não-bloqueante) é acionado nos 5 momentos chave:
  1. *Entregador:* Após confirmação de recebimento/pagamento do turno;
  2. *Entregador:* Ao subir de nível no ranking de gamificação (Bronze → Prata → Ouro);
  3. *Lojista:* Ao ter vaga de emergência aceita em menos de 5 minutos;
  4. *Lojista:* Ao avaliar um entregador com 5 estrelas;
  5. *Parceiro API:* Ao atingir 1.000 requisições de sucesso no mês.
- **Opções de Valor:** Chips pré-definidos de `[ R$ 2,00 ]`, `[ R$ 5,00 ]`, `[ R$ 10,00 ]`, `[ Outro Valor ]` e saída clara `[ Agora Não ]` (sem contadores de bloqueio ou dark patterns).
- **FR-11 (Chave PIX Estática Mockada e Cópia em 1 Clique):** Ao clicar em copiar, o sistema copia o payload BR Code da Chave PIX Estática para a área de transferência com vibração tátil (*Haptic Feedback*) e toast de confirmação. Registra o evento anonimamente em `donations_log`.
- **FR-12 (Painel Público de Transparência de Custos do Servidor):** Indicador público de arrecadação comunitária vs. custo real mensal de servidores (Supabase, FCM, hosting estático), exibindo banner de *Vitória Coletiva* ao atingir 100% da meta.
- **NFR-8 (Frugalidade e Custo Operacional Zero):** Sem custódia de valores ou intermediação bancária. A chave PIX aponta diretamente para a chave da entidade comunitária mantenedora.
- **NFR-9 (Usabilidade Touch & Mobile):** Alvos de toque $\ge 48\text{px}$, suporte a vibração háptica (`navigator.vibrate([15, 50, 15])`).

## Technical Decisions

- **Persistência em PostgreSQL (Supabase):**
  - Tabela `donations_log` com campos `id`, `user_id` (opcional/anônimo), `trigger_moment`, `suggested_amount` e `copied_at`.
  - RLS permitindo inserção anônima e autenticada.
- **Configuração de Ambiente PIX:**
  - Suporte a variáveis `PUBLIC_PIX_KEY`, `PUBLIC_PIX_RECIPIENT_NAME`, `PUBLIC_PIX_CITY`, `PUBLIC_PIX_BRCODE_PAYLOAD` via `.env` e módulo `pix-config.ts`.
  - Fallback para gerador de payload EMVCo BR Code padrão caso não seja fornecida chave customizada.
- **Arquitetura Hexagonal:**
  - `apps/pwa/src/donations/donation-service.ts` gerenciando o registro de doações, configuração do PIX e estatísticas de arrecadação.

## Cross-Story Dependencies

- **Story 4.1** estabelece a fundação de banco de dados (`donations_log`), variáveis de ambiente e SDK que abastecem o modal da **Story 4.2**, as regras de gamificação da **Story 4.3** e o painel de transparência da **Story 4.4**.
- Consome eventos dos épicos anteriores:
  - Epic 1: Subida de nível de usuário (`level_up`);
  - Epic 2: Conclusão de turno (`shift_completed`), aceite rápido de emergência (`emergency_matched`), e avaliação 5 estrelas (`rating_5_stars`).
