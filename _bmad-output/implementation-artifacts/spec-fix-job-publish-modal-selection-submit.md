---
title: 'Isolamento de Submissão do Modal de Publicação de Vagas'
type: 'bugfix'
created: '2026-09-10'
status: 'done'
route: 'one-shot'
---

# Isolamento de Submissão do Modal de Publicação de Vagas

## Intent

**Problem:** Ao clicar nos botões de modal de transporte (Moto, Bike, E-Bike) dentro do `RegionalPricingWidget`, o formulário pai de publicação de vagas era submetido indevidamente por ausência de `type="button"` nos botões.

**Approach:** Definir `type="button"` explicitamente nos botões do seletor de modal do balizador e configurar `type = 'button'` como valor padrão defensivo no componente `Button` do Design System.

## Suggested Review Order

**Prevenção de Submissão Indevida no Widget**

- Botões de seleção de modal configurados explicitamente com `type="button"`
  [`RegionalPricingWidget.tsx:135`](../../apps/pwa/src/components/pricing/RegionalPricingWidget.tsx#L135)

**Padrão Defensivo no Design System**

- Componente Button configurado com `type = 'button'` por padrão
  [`Button.tsx:26`](../../apps/pwa/src/components/ui/Button.tsx#L26)

- Atributo type repassado ao elemento button nativo
  [`Button.tsx:136`](../../apps/pwa/src/components/ui/Button.tsx#L136)

- Botão de submissão do formulário de perfil tornado explicitamente `type="submit"`
  [`ProfileCompletionForm.tsx:1214`](../../apps/pwa/src/components/profile/ProfileCompletionForm.tsx#L1214)

**Validação e Testes Automatizados**

- Suíte de testes verificando types nos botões e validação do fluxo exclusivo de submissão
  [`pricing-widget-ui.test.js:82`](../../tests/pricing-widget-ui.test.js#L82)
