---
title: 'Story 4.3: Mensuração de Valor Retido e Gratidão Fraterna (Revogação de Badges por Conformidade Fiscal e Isonomia)'
type: 'architecture-pivot'
created: '2026-09-08'
updated: '2026-09-09'
status: 'renegotiated-and-aligned'
renegotiation_reason: 'Decisão Humana e Party Mode: Blindagem contra risco fiscal (evitar caracterização de venda de serviço/ISS similar ao selo pago do Instagram) e preservação da isonomia radical entre trabalhadores.'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated on 2026-09-09 by user direction">

## Architectural Decision Record (ADR-4.3: Desacoplamento Fiscal e Revogação de Badges)

- **Contexto:** A especificação original previa concessão de badge de *Apoiador da Comunidade* e $+25\text{ XP}$ no perfil do usuário após apoio via PIX.
- **Risco Identificado:** No Direito Tributário brasileiro, a existência de uma contraprestação estética exclusiva no perfil (similar ao selo pago do Instagram / Meta Verified) pode ser utilizada por auditores fiscais para desqualificar a natureza jurídica de doação pura (Art. 538 do Código Civil), reclassificando-a como venda de serviço digital ou ativo intangível, com exigência de abertura de empresa comercial (SaaS), emissão de NF-e e incidência de ISS. Além disso, cria disparidade e castas visuais entre entregadores no trânsito e nas vagas.
- **Decisão:** Revogar e expurgar a concessão de badges e pontuação de XP vinculadas ao PIX. O deLIVREry permanece um bem comum aberto (*Digital Commons*), com doações 100% anônimas e desvinculadas de qualquer contrapartida digital.

## Intent

**Problem:** Para que a sustentabilidade da plataforma seja autêntica e livre de atritos fiscais ou divisões comunitárias, os usuários precisam compreender o valor tangível gerado pelo ecossistema em suas vidas (dinheiro economizado em taxas abusivas) sem que o aplicativo ofereça contrapartidas individuais ou crie privilégios visuais.

**Approach:** 
1. Eliminar a dependência de colunas de apoiador (`community_supporter`) ou gatilhos de pontuação de XP por doação no banco de dados.
2. Apresentar no momento de confirmação de cópia do PIX um cálculo estimado de **Valor Retido no Bolso**: *"Neste período, você realizou suas operações sem pagar comissões predatórias. Sua economia estimada: ~R$ X."*
3. Exibir uma mensagem calorosa e fraterna de gratidão coletiva: *"Essa ferramenta existe e evolui porque você e a comunidade escolheram a independência. Tamo junto!"*.
4. Garantir que os cards de vagas (`JobCard.tsx`), propostas (`StoreJobManagementCard.tsx`) e cabeçalho mantenham tratamento absolutamente isonômico para todos os trabalhadores e lojistas.

## Boundaries & Constraints

- **Isonomia Radical:** Nenhum usuário recebe destaque prioritário, cor diferenciada de avatar ou selo por ter contribuído financeiramente. Todos competem e operam sob as mesmas regras.
- **Zero Estado no Banco de Dados (Zero-State Privacy):** A confirmação pós-cópia opera no cliente e/ou dados agregados anônimos, sem necessidade de conciliação bancária ou armazenamento de histórico financeiro nominal.
- **Sem Shaming / Sem Barreira:** O cálculo de valor retido tem caráter puramente comemorativo e reflexivo, nunca de cobrança disfarçada ou coação psicológica.

## Acceptance Criteria

1. **Remoção de Vínculo de Badges/XP a Pagamentos:**
   - O sistema NÃO concede pontuação de XP nem altera níveis de perfil em decorrência de eventos de cópia ou doação PIX.
   - Nenhum selo comemorativo ou badge de apoiador é injetado nos cards de vagas ou cabeçalho do app.

2. **Mensagem de Gratidão Fraterna Pós-Cópia:**
   - Ao copiar a chave PIX, o toast/modal exibe feedback de camaradagem: *"Chave PIX copiada! Obrigado por manter a logística livre e nas mãos de quem trabalha."*

3. **Exibição Educativa de Valor Retido:**
   - Na visualização pós-turno ou resumo operacional, o app apresenta discretamente o volume de comissões economizadas em comparação às plataformas convencionais de intermediação.

4. **Preservação dos Testes de Isonomia:**
   - Suíte de testes validando que os cards de proposta e listagens tratam todos os perfis com padrão visual unificado.

</frozen-after-approval>
