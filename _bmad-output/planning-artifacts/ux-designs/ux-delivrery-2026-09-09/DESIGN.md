---
name: deLIVREry
description: Sistema de design tático, ergonômico e de alto contraste para logística peer-to-peer sem taxas.
status: final
updated: 2026-09-09
colors:
  bg-base: '#06090E'
  bg-surface: '#0D121C'
  bg-surface-raised: '#141B29'
  border-subtle: '#1E293B'
  border-focus: '#00F59B'
  neon-emerald: '#00F59B'
  neon-emerald-glow: 'rgba(0, 245, 155, 0.25)'
  highvis-yellow: '#FFE600'
  highvis-yellow-dim: 'rgba(255, 230, 0, 0.12)'
  alert-warning: '#F59E0B'
  alert-warning-dim: 'rgba(245, 158, 11, 0.15)'
  text-primary: '#F8FAFC'
  text-secondary: '#94A3B8'
  text-muted: '#64748B'
  whatsapp-green: '#25D366'
typography:
  brand:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 900
    letterSpacing: '-0.03em'
    textTransform: 'uppercase'
  heading:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 800
    letterSpacing: '-0.01em'
  body:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 500
    lineHeight: '1.5'
  metric:
    fontFamily: "'JetBrains Mono', monospace"
    fontWeight: 900
    letterSpacing: '-0.02em'
rounded:
  sm: '8px'
  md: '12px'
  lg: '18px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '7': '32px'
  touch-min: '48px'
  touch-primary: '54px'
components:
  btn-cta:
    background: '{colors.neon-emerald}'
    color: '#032314'
    borderRadius: '{rounded.md}'
    minHeight: '{spacing.touch-primary}'
    fontWeight: 900
    boxShadow: '0 4px 16px {colors.neon-emerald-glow}'
  btn-secondary:
    background: 'transparent'
    color: '{colors.text-secondary}'
    border: '1.5px solid {colors.border-subtle}'
    borderRadius: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
    fontWeight: 700
  btn-whatsapp:
    background: '{colors.whatsapp-green}'
    color: '#052410'
    borderRadius: '{rounded.md}'
    minHeight: '{spacing.touch-primary}'
    fontWeight: 900
  card-job:
    background: '{colors.bg-surface}'
    border: '1.5px solid {colors.border-subtle}'
    borderRadius: '{rounded.lg}'
    padding: '{spacing.5}'
  card-highlight:
    border: '1.5px solid rgba(0, 245, 155, 0.4)'
  card-matched:
    background: '#081A13'
    border: '2px solid {colors.neon-emerald}'
    borderRadius: '{rounded.lg}'
    boxShadow: '0 0 32px {colors.neon-emerald-glow}'
  bottom-nav:
    background: 'rgba(13, 18, 28, 0.95)'
    borderTop: '1px solid {colors.border-subtle}'
    minHeight: '64px'
---

# deLIVREry — Design System Spine

## 1. Brand & Style

O deLIVREry é uma ferramenta operacional de empoderamento logístico, não uma rede social de entretenimento. Sua estética visual combina o rigor de um **terminal tático moderno** com a **ergonomia de alta visibilidade** necessária para motoboys e entregadores trabalhando sob sol a pino, chuva e trânsito noturno, e lojistas coordenando turnos em balcões movimentados.

O tom visual transmite agilidade, autonomia, precisão monetária e independência de intermediários corporativos abusivos.

## 2. Colors

- `{colors.bg-base}` (`#06090E`): Fundo obsidiana profundo. Reduz consumo de bateria em telas OLED e elimina fadiga ocular em operações noturnas.
- `{colors.bg-surface}` (`#0D121C`): Superfície padrão para cards de vagas e formulários.
- `{colors.bg-surface-raised}` (`#141B29`): Superfície elevada para caixas de valores, filtros ativos e badges secundários.
- `{colors.border-subtle}` (`#1E293B`): Delimitação nítida entre elementos para alta legibilidade.
- `{colors.neon-emerald}` (`#00F59B`): Cor de ação principal, confirmação e vitória. Aplicada em CTAs primários, valores monetários de ganho e status positivo de turnos.
- `{colors.highvis-yellow}` (`#FFE600`): Acento de alta visibilidade viária. Usado para médias regionais de preços, valores complementares por entrega e chamadas de atenção.
- `{colors.alert-warning}` (`#F59E0B`): Usado no validador visual quando uma contraproposta foge da média praticada no bairro.
- `{colors.whatsapp-green}` (`#25D366`): Ação imediata de contato com a loja após o turno ser fechado.
- `{colors.text-primary}` (`#F8FAFC`) e `{colors.text-secondary}` (`#94A3B8`): Texto com contraste acima de 7:1 (WCAG AAA).

## 3. Typography

- **Títulos e Interface**: Fonte `Inter` (pesos 600, 700, 800 e 900). Letras limpas, neutras e altamente legíveis em telas de densidades variadas.
- **Valores Monetários e Horários**: Fonte monoespaçada `JetBrains Mono` (pesos 700 e 900). Garante que dígitos e centavos mantenham alinhamento tabular perfeito e leitura instantânea a distância.
- **Hierarquia:**
  - Valores do Turno: 26px a 28px (`JetBrains Mono`, 900).
  - Nomes das Lojas / Títulos: 18px a 20px (`Inter`, 800).
  - Textos de Apoio e Horários: 13px a 14px (`Inter`, 500/600).
  - Badges e Metadados: 11px a 12px (`Inter`, 700/800, uppercase).

## 4. Layout & Spacing

- **Filosofia Mobile-First e Prevenção de Overflow:**
  - `html, body { width: 100%; max-width: 100vw; overflow-x: hidden; }`
  - Todos os containers flex e grid utilizam `min-width: 0;` e `minmax(0, 1fr)` para impedir que filhos com texto longo empurrem a largura da tela além dos limites do viewport.
  - Padding lateral de `14px` a `16px` no mobile para garantir encaixe perfeito em telas a partir de 360px (Samsung Galaxy, iPhone SE, etc.).
- **Adaptação Desktop / Tablet (Lojistas):** Layout em **2 colunas** (`@media (min-width: 900px)`):
  - Coluna Principal (esquerda, `minmax(0, 1.25fr)`): Turnos ativos, feed de vagas e candidaturas recebidas.
  - Coluna Lateral (direita, `minmax(0, 0.75fr)`): Painel do preço médio da região, meta do bairro e apoio comunitário.
- **Zonas de Toque (Touch Targets):**
  - Botões primários (`btn-cta`, `btn-whatsapp`): Altura de `{spacing.touch-primary}` (52px a 54px) com `word-break: break-word` e `text-align: center`.
  - Botões secundários e pílulas de filtro: Altura mínima de `{spacing.touch-min}` (48px).
- **Espaçamento Interior:** Gutter de 14px a 16px no mobile e 24px no desktop.

## 5. Elevation & Depth

Não utilizamos sombras pesadas ou skeumorfismo ultrapassado. A profundidade é expressa através de:
- Camadas tonais (`#06090E` -> `#0D121C` -> `#141B29`).
- Bordas sutis iluminadas (`1.5px solid #1E293B`).
- Glow sutil esmeralda (`0 4px 16px rgba(0, 245, 155, 0.25)`) apenas em elementos de sucesso ou botões de conversão.

## 6. Shapes

- Cards e Painéis: Cantos arredondados `{rounded.lg}` (18px) para acolhimento moderno sem perder solidez.
- Botões e Inputs: Cantos `{rounded.md}` (12px) para encaixe perfeito do polegar.
- Badges de Status e Quórum: Cantos `{rounded.full}` (pílulas de 9999px).

## 7. Components

- **`btn-cta`**: Botão verde-esmeralda sólido com texto escuro de alto contraste (`#032314`).
- **`btn-whatsapp`**: Botão massivo verde WhatsApp oficial, acionado apenas quando o turno estiver fechado.
- **`card-job`**: Card de turno contendo cabeçalho com nome do estabelecimento, modalidade (`MOTO`, `BIKE`, `CARRO`), caixa destacada de valores e botões de decisão.
- **`card-matched`**: Card especial de turno ativo para hoje, com borda esmeralda pulsante e atalho imediato para contato.
- **`bottom-nav`**: Barra inferior fixa no mobile com efeito blur (`backdrop-filter: blur(12px)`), permitindo navegação rápida pelo polegar. Ocultada no desktop.

## 8. Do's and Don'ts

- **DO**: Use linguagem simples, direta e acessível ("Preço médio do bairro", "Turno fechado", "Propor outro valor").
- **DO**: Mantenha áreas de toque de pelo menos 48px em qualquer elemento interativo.
- **DO**: Formate todos os valores monetários em `JetBrains Mono` com `R$` e centavos destacados.
- **DON'T**: Não use termos acadêmicos ou técnicos ("balizador", "bid/ask", "quórum", "outlier", "passwordless").
- **DON'T**: Não misture cartões com fundo branco puro em páginas com tema escuro.
- **DON'T**: Não esconda ações críticas de contato do lojista ou aceite de turno atrás de múltiplos submenus.
