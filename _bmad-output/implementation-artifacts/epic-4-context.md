# Epic 4 Context: Sustentabilidade e Autonomia Operacional por Contribuições Voluntárias PIX em Delight Moments

<!-- Compiled from planning artifacts and Party Mode Architectural Decisions (2026-09-09). Edit freely. -->

## Goal

Garantir a soberania, perenidade e sustentabilidade da operação integral e do esforço contínuo da equipe do deLIVREry através de contribuições financeiras voluntárias via PIX, acionadas estrategicamente em momentos de alta satisfação operacional (*Delight Moments*). A plataforma opera sob a filosofia de *Digital Commons* (bem comum aberto): não há taxas predatórias, nem mensalidades SaaS, nem cobrança de comissões. A sustentabilidade se apoia na reciprocidade genuína e no valor evidente gerado aos usuários (economia de taxas).

## Stories

- **Story 4.1:** Schema de Logs de Microdoação (`donations_log`) e Configuração de Ambiente PIX
- **Story 4.2:** Componente Bottom Sheet de Contribuição Operacional PIX com Haptic Feedback nos 5 Delight Moments
- **Story 4.3:** Mensuração de Valor Retido e Gratidão Fraterna (Substituição de Badges por Conformidade Fiscal e Isonomia)
- **Story 4.4:** Painel Público de Vitalidade e Sustentação Operacional da Praça (Sem Cifras Monetárias)

## Requirements & Constraints

- **FR-10 (Disparo nos 5 Delight Moments):** O componente de apoio operacional (Bottom Sheet / Modal não-bloqueante) é acionado de forma elegante e contextual:
  1. *Entregador:* Após confirmação de pagamento integral do turno (destacando a retenção de 100% dos ganhos);
  2. *Entregador:* Ao subir de nível operacional (Bronze → Prata → Ouro);
  3. *Lojista:* Ao ter vaga de emergência aceita em menos de 5 minutos;
  4. *Lojista:* Ao avaliar um entregador com 5 estrelas;
  5. *Parceiro API:* Ao atingir 1.000 requisições de sucesso no mês.
- **Narrativa Convincente (Sem Caridade):** A abordagem comunica independência e sustentação do esforço de equipe. A saída é livre em 1 toque `[ Agora Não ]` (sem contadores de bloqueio ou manipulação psicológica).
- **FR-11 (Chave PIX Estática e Zero Risco Fiscal):** Ao clicar em copiar, o sistema copia o payload BR Code da Chave PIX Estática com vibração tátil (*Haptic Feedback*) e mensagem de celebração fraterna.
- **Conformidade Fiscal & Isonomia (Decisão de 2026-09-09):** Nenhuma badge, selo de apoiador ou pontuação de XP é atrelada à contribuição financeira. Isso elimina o risco fiscal de reclassificação tributária da doação como venda de serviço digital / ativos intangíveis (evitando incidência de ISS/bitributação como no caso do selo pago do Instagram) e protege a igualdade radical entre entregadores e lojistas no aplicativo.
- **FR-12 (Painel Visual de Vitalidade da Praça):** Indicador visual de saúde e fôlego da operação da comunidade em faixas qualitativas (*Operação Básica* ➔ *Operação Saudável* ➔ *Evolução e Suporte Pleno*), sem expor valores monetários em Reais (R$). Exibe banner de *Vitória Coletiva* ao atingir 100% da sustentação do mês.
- **NFR-8 (Frugalidade e Custo Operacional Zero):** Sem custódia de valores, sem intermediação bancária e sem necessidade de conciliação bancária/webhooks de validação de pagamento.
- **NFR-9 (Usabilidade Touch & Mobile):** Alvos de toque $\ge 48\text{px}$, suporte a vibração háptica (`navigator.vibrate([15, 50, 15])`).

## Technical Decisions

- **Persistência em PostgreSQL (Supabase):**
  - Tabela `donations_log` apenas para registro estatístico e anônimo da intenção de cópia do PIX.
  - Zero dependência de tabela de reconciliação de doadores ou colunas de perfil tipo "apoiador".
- **Configuração de Ambiente PIX:**
  - Suporte a variáveis `PUBLIC_PIX_KEY`, `PUBLIC_PIX_RECIPIENT_NAME`, `PUBLIC_PIX_CITY`, `PUBLIC_PIX_BRCODE_PAYLOAD` via `.env` e módulo `pix-config.ts`.
  - Fallback para gerador de payload EMVCo BR Code padrão.
- **Arquitetura Hexagonal:**
  - `apps/pwa/src/donations/donation-service.ts` gerenciando a emissão da chave PIX e cálculo das faixas de vitalidade da praça.

## Cross-Story Dependencies

- **Story 4.1** estabelece a infraestrutura básica e variáveis de ambiente que abastecem a **Story 4.2** e o painel da **Story 4.4**.
- **Story 4.3** formaliza o desacoplamento fiscal (remoção de badges individuais) e a mensagem de reciprocidade e valor retido no bolso do usuário.
- Consome eventos dos épicos anteriores:
  - Epic 1: Subida de nível de usuário (`level_up`);
  - Epic 2: Conclusão de turno (`shift_completed`), aceite rápido de emergência (`emergency_matched`), e avaliação 5 estrelas (`rating_5_stars`).
