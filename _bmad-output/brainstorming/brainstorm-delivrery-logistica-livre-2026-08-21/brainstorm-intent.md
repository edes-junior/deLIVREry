# deLIVREry — Intent Document de Brainstorming

**Data:** 2026-08-21  
**Projeto:** deLIVREry (O Engine de Logística Livre — API-First & Headless Engine)  
**Status do Memlog:** Complete (`_bmad-output/brainstorming/brainstorm-delivrery-logistica-livre-2026-08-21/.memlog.md`)  
**Keepsake Interativo:** [`brainstorm.html`](file:///c:/Users/edes.junior/deLIVREry/_bmad-output/brainstorming/brainstorm-delivrery-logistica-livre-2026-08-21/brainstorm.html)

---

## 1. Visão Central & Objetivos

O **deLIVREry** é uma infraestrutura aberta de logística P2P, desacoplada (API-First / Headless) e 100% gratuita, criada para eliminar intermediários e comissões abusivas no delivery nacional. A plataforma conecta diretamente comerciantes locais e entregadores autônomos por meio de leilão/balizador Bid/Ask regional, financiada exclusivamente por microdoações espontâneas via PIX Copia e Cola em momentos de alta satisfação operacional (*Delight Moments*).

---

## 2. Principais Descobertas e Decisões Estratégicas (Synthesis)

### 🌟 A. Motor de Tração & Viralidade Orgânica (Gatilho de Desbloqueio Hiperlocal)
- **Termômetro de Desbloqueio de Bairro:** O PWA exibe em tempo real o progresso para ativação da região (meta: 10 lojas + 50 entregadores em raio de 3km). Ao se aproximar do marco, dispara contagem regressiva e incentiva o compartilhamento por WhatsApp.
- **Selo de Fundadores:** Primeiros 20 entregadores e 5 lojas ganham insígnia perpétua de "Fundador do Bairro", conferindo prestígio e destaque no balizador de reputação.
- **Lojistas Embaixadores:** Painel para convidar restaurantes vizinhos em 1 clique para viabilizar a frota do polo gastronômico.

### 💰 B. Modelo de Sustentabilidade por Delight Moments (Microdoações PIX)
- **Doação pós-vitória:** O gatilho de doação (chips de R$ 2,00 / R$ 5,00 / R$ 10,00 com botão "Copiar PIX" em 1 clique) é acionado exclusivamente quando o usuário sente a vitória concreta (ex: motoboy salvando pedido de emergência em <5 min; lojista economizando comissões; motoboy recebendo 100% da diária).
- **Transparência Comunitária em Tempo Real:** Barra de status público dos custos de servidor (Supabase/FCM). Ao cobrir 100% da meta mensal, ativa-se o "Modo Vitória Comunitária".

### 🔌 C. Ecossistema Headless & Integrações B2B
- **Componente Embutível (`<delivrery-button />`):** Widget web para cardápios digitais próprios e sistemas de pedidos locais acionarem entregadores da rede sem custo de API.
- **Integração com Portais Municipais & PDVs:** Endpoints abertos com suporte a multi-tenant geolocalizado (`city_id`, `neighborhood_id`) e emissão autônoma de API Keys.

### 🛡️ D. Inteligência de Preço Bid/Ask & Anti-Manipulação
- **Balizador P2P Transparente:** Exibição da mediana, mínimo e máximo regional ($P_{min}, P_{med}, P_{max}$).
- **Filtro 1.5×IQR e Trava de Velocidade:** Expulgo de outliers para evitar cartéis ou ofertas predatórias, mantendo o equilíbrio dinâmico e a autonomia das partes.

---

## 3. Roteiro Imediato de Execução (Sprint 1)

1. **Polo Piloto:** Concentrar a ativação em 1 cluster urbano de alta densidade (ex: Icaraí em Niterói).
2. **Landing Pages A/B/C:** Medição de conversão focada nas dores reais de motoboys e lojistas.
3. **Core Engine & Portal do Desenvolvedor:** Disponibilização dos endpoints `/api/v1/jobs`, `/api/v1/couriers`, `/api/v1/stores` e `/api/v1/analytics/pricing-stats`.
4. **PWA Mobile-First Resiliente:** Foco em baixa latência, interface para uso em trânsito e feedback tátil em 48px.

---

*Documento preparado como insumo formal para refinamento de PRD, especificação de arquitetura e backlog de stories.*
