---
name: deLIVREry
status: final
sources:
  - _bmad-output/planning-artifacts/prds/prd-deLIVREry-2026-08-21/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-deLIVREry-2026-08-21/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
updated: 2026-09-09
---

# deLIVREry — Experience Spine

## 1. Foundation

O deLIVREry é um Progressive Web App (PWA) peer-to-peer operado em dois contextos críticos:
1. **Entregadores (Rua):** Em trânsito sobre duas rodas, aparelho montado em suporte de guidão sob iluminação natural variável, uso pontual com luvas e necessidade de tomada de decisão em poucos segundos.
2. **Lojistas (Comércio Local):** Em balcões ou caixas de restaurantes, utilizando celular, tablet ou desktop, gerenciando despachos e turnos em meio ao fluxo operacional da cozinha.

A identidade visual de referência é detalhada em `DESIGN.md`. O tema escuro de alto contraste é o padrão absoluto do sistema.

## 2. Information Architecture

### Estrutura de Telas e Destinos

| Superfície | Origem | Papel e Conteúdo Principal |
|---|---|---|
| **Acesso Rápido** | Primeira visita | Entrada sem senha: email do usuário e envio instantâneo de link de acesso. |
| **Completar Perfil** | Pós-login (perfil novo) | Escolha de papel (Entregador ou Loja), nome, CPF/CNPJ e localização (bairro/cidade). |
| **Feed de Turnos** | Aba principal (Entregador) | Filtro de veículo, lista de vagas abertas com valores em destaque e aceite/proposta. |
| **Painel da Loja** | Aba principal (Lojista) | Botão para publicar turno hoje, lista de candidaturas recebidas e turnos confirmados. |
| **Preço Médio da Região** | Aba 2 | Painel com a média dos valores praticados no bairro, sem comissão abusiva de app. |
| **Meta do Bairro** | Aba 3 | Termômetro de desbloqueio do bairro e link de convite rápido para amigos. |
| **Apoio Comunitário PIX** | Aba 4 / Bottom Sheet | Transparência de custo do servidor e chave PIX copia-e-cola com valor livre. |
| **Portal do Integrador** | Rota `/developers` | Documentação para desenvolvedores e Web Component embutível para cardápios. |

### Navegação
- **Mobile (PWA):** Barra inferior fixa (`Bottom Navigation`) com 4 atalhos com ícone e rótulo claro (*Turnos*, *Preços*, *Meta Bairro*, *Apoiar*).
- **Desktop / Tablet:** Layout inteligente de 2 colunas sem barra inferior fixa; navegação integrada no cabeçalho.

## 3. Voice and Tone (Comunicação Direta e Humana)

Eliminamos todo o jargão técnico e acadêmico da engenharia. A comunicação adota o tom natural de entregadores e comerciantes no dia a dia:

| ❌ Termo Antigo / Técnico | ✅ Termo Adotado na Interface | Por que a mudança? |
|---|---|---|
| *Balizador regional de preços* | **Preço médio na sua região** / **Preço médio do bairro** | Imediato, claro e sem afetação. |
| *Mediana justa por turno* | **Média mais paga por turno** | Comunica o ganho real esperado. |
| *Matching bid/ask* | **Negociar valor** / **Propor outro valor** | O usuário entende que é uma proposta comercial direta. |
| *Quórum regional de ativação* | **Meta de entregadores no bairro** | Transforma um conceito estatístico em um objetivo de equipe. |
| *Autenticação passwordless* | **Entrar sem senha (link no e-mail)** | Explica o benefício em vez do protocolo. |
| *Expulgo de outliers* | **Aviso de valor fora do padrão do bairro** | Evita estranheza sem perder o efeito protetor. |
| *Doação de sustentação* | **Apoiar o projeto (PIX livre)** | Clareza de que a contribuição é voluntária e comunitária. |
| *Fechamento de matching* | **Turno fechado!** | Comemoração de acordo alcançado. |

## 4. Component Patterns (Padrões de Comportamento)

- **Feedback Tátil (Haptics):**
  - Ao enviar uma proposta de valor: vibração curta (40ms).
  - Ao copiar a chave PIX voluntária: vibração dupla de confirmação.
  - Ao confirmar um turno (match): vibração comemorativa e abertura do card destacado.
- **Áreas de Toque:**
  - Todo botão e elemento tocável possui no mínimo 48px de altura. Botões de ação rápida de turno têm 54px.
- **Validador Visual de Propostas:**
  - Se a proposta digitada estiver acima ou abaixo de 30% da média do bairro, exibe uma pílula informativa amarela (`alert-warning`): *"⚠️ Proposta fora da média do bairro. Pode demorar mais para a loja aceitar."* O envio não é bloqueado, apenas sinalizado.

## 5. State Patterns

- **Sem Vagas no Bairro (Empty State):** Em vez de tela em branco, exibe: *"Nenhum turno aberto em Pinheiros agora. Seja o primeiro a convidar uma loja do bairro e desbloqueie o grupo!"* acompanhado do botão de convite.
- **Turno Fechado (Success State):** O card superior do app ganha borda esmeralda iluminada com o botão massivo: *"Falar com o Restaurante no WhatsApp"*, abrindo a conversa com uma mensagem pré-formatada.
- **Carregando Dados (Loading State):** Esqueletos pulsantes (skeleton loaders) em cinza escuro no lugar dos cards, preservando o layout sem piscadas na tela.

## 6. Interaction Primitives

1. **Aceite Direto com 1 Toque:** Se o entregador concordar com o valor oferecido, basta tocar em *"Aceitar pelo Valor Ofertado"*. A proposta é registrada instantaneamente.
2. **Proposta Rápida (Passo a Passo):** Tocar em *"Propor Outro Valor"* abre botões rápidos de incremento (`+ R$ 5`, `+ R$ 10`, `+ R$ 15`) além do campo numérico livre.
3. **Chave PIX em 1 Toque:** Tocar em *"Copiar Chave PIX"* aciona a área de transferência com feedback tátil e troca o texto do botão para *"Copiado! Cole no app do seu banco 💚"*.

## 7. Accessibility Floor

- Contraste superior a 7:1 (WCAG AAA) em todos os textos sobre fundos escuros.
- Fontes nunca menores que 12px; rótulos secundários em 13px e dados principais em 26px a 28px.
- Sem dependência exclusiva de cor para transmitir estado (ícones como ⚠️, ⚡, 💬 acompanham as cores).

## 8. Key Flows

### Jornada 1: Lucas (Motoboy autônomo)
1. Lucas estaciona a moto após uma entrega às 18h30. Abre o deLIVREry no celular.
2. A barra de status indica que Pinheiros tem 92% da meta e o preço médio é R$ 130,00 por turno.
3. Lucas vê a vaga da *Pizzaria Bella Napoli* oferecendo R$ 140,00 + R$ 6,50/entrega.
4. Toca em *"Aceitar pelo Valor Ofertado"*. O celular vibra suavemente.
5. Em 2 minutos, a pizzaria confirma. O card de topo acende em verde com o botão *"Falar com a Pizzaria no WhatsApp"*. Lucas toca e avisa que chega às 19h.

### Jornada 2: Dona Carmem (Dona de Lanchonete no balcão)
1. Sexta-feira às 17h, o motoboy fixo de Dona Carmem avisa que não vai poder ir.
2. Carmem abre o deLIVREry no tablet ou computador do balcão. A tela se divide em 2 colunas.
3. Na coluna esquerda, ela toca em *"Publicar Vaga de Turno"*, preenche 19h às 23h30 e R$ 140,00.
4. Na coluna direita, o sistema confirma que R$ 140,00 está alinhado com o preço médio do bairro.
5. Em poucos minutos chegam 2 entregadores interessados; ela escolhe um com 1 clique e o WhatsApp abre com a conversa pronta.
