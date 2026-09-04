---
title: deLIVREry — O Engine de Logística Livre (API-First & Headless Engine)
created: 2026-08-21
updated: 2026-08-21
status: draft
---

# PRD: deLIVREry — O Engine de Logística Livre (API-First & Headless Engine)

## 0. Document Purpose

Este documento define os requisitos de produto, regras de negócio, fluxos de usuários e contratos funcionais do **deLIVREry**, a primeira infraestrutura descentralizada de logística sob demanda (P2P), 100% gratuita, neutra e desacoplada (API-First/Headless) do Brasil. Ele serve como a fonte canônica de verdade para engenharia de software, arquitetura de sistemas, design de produto/UX e parceiros integradores de ecossistemas (portais municipais, sistemas de PDV e cardápios digitais). Detalhes aprofundados de implementação técnica de banco de dados, payloads de rede e esquemas de Edge Functions estão preservados no [addendum.md](file:///c:/Users/edes.junior/deLIVREry/_bmad-output/planning-artifacts/prds/prd-deLIVREry-2026-08-21/addendum.md).

---

## 1. Vision

O mercado de delivery no Brasil é estrangulado por monopólios que cobram até 27% de comissões predatórias dos comerciantes locais e retêm valores significativos das corridas de entregadores autônomos, enquanto impõem algoritmos opacos de punição e bloqueio.

O **deLIVREry** existe para restituir a liberdade e a soberania das pontas operacionais da economia local em todo o território nacional:
1. **Zero Taxas e Zero Comissões:** 100% do valor acordado é pago diretamente pelo lojista ao entregador (via PIX direto ou dinheiro), sem intermediários financeiros retendo capital.
2. **Arquitetura Neutra e Headless:** O deLIVREry funciona como um protocolo de infraestrutura pública — qualquer sistema de gestão (PDV), portal de prefeitura ou cardápio digital pode consumir a API para orquestrar entregas na sua cidade.
3. **Sustentabilidade Comunitária por Delight Moments:** A plataforma mantém custo operacional zero e se financia unicamente por microdoações espontâneas via PIX Copia e Cola (R$ 2,00 a R$ 10,00) disparadas exclusivamente em momentos de alta satisfação e alívio operacional (utilizando Chave PIX estática configurável).
4. **Desbloqueio Orgânico Regional e Universal:** A rede é aberta nacionalmente e se expande organicamente por qualquer bairro e município brasileiro que atinja quórum operacional mínimo, orientada por um balizador transparente de mercado (*Bid/Ask*) com proteção anti-manipulação.

---

## 2. Target User

### 2.1 Jobs To Be Done (JTBD)

- **Entregador Autônomo (Motoboy, Ciclista, E-Bike) em Qualquer Região do Brasil:**
  - *Funcional:* "Quero definir minhas próprias tarifas de diária e taxa por entrega, encontrar turnos compatíveis com meu modal e receber 100% do dinheiro sem retenção na minha localidade."
  - *Emocional:* "Quero trabalhar sem medo de desativações injustas e sentir que meu esforço é respeitado e valorizado na minha região."
  - *Social:* "Quero ter prestígio perante os comércios locais e construir um histórico profissional comprovável."

- **Lojista / Comerciante Local:**
  - *Funcional:* "Quero cobrir turnos de entrega e emergências operacionais com motoboys avaliados, pagando um preço justo de mercado regional sem pagar comissões sobre faturamento."
  - *Emocional:* "Quero ter paz de espírito durante o horário de pico sabendo que minhas entregas não vão atrasar por falta de entregador."
  - *Contextual:* "Quero que meu sistema de pedidos acione entregadores automaticamente sem eu precisar operar múltiplos aparelhos."

- **Parceiro Integrador / Desenvolvedor B2B (Portais Municipais, PDVs, Cardápios):**
  - *Funcional:* "Quero oferecer capacidade logística sob demanda para os comércios da minha plataforma ou município através de uma API simples, robusta e gratuita."
  - *Estratégico:* "Quero incentivar a economia local da minha cidade sem arcar com custos de desenvolvimento de um engine logístico complexo."

### 2.2 Non-Users (v1)

- **Consumidor Final de Comida/Produtos:** O deLIVREry v1 não é um marketplace de venda de comida (não possui catálogo de pratos para o cliente pedir pizza); é exclusivamente o motor logístico entre o comerciante e o entregador.
- **Operações de Carga Pesada Intermunicipal:** O sistema é focado em logística urbana expressa (raio de até 15km).

### 2.3 Key User Journeys

- **UJ-1. Carlos (Motoboy) assume um plantão de sábado em seu bairro e contribui com a plataforma.**
  - **Persona + contexto:** Carlos, 28 anos, motoboy autônomo.
  - **Entry state:** Autenticado via Magic Link no PWA instalado no celular preso ao guidão.
  - **Path:** Carlos abre o PWA, seleciona sua cidade/bairro e visualiza o mapa de vagas abertas e o balizador regional ($P_{med} = R\$\;80,00$ diária + $R\$\;6,00$/entrega). Uma hamburgueria a 800m publica uma vaga para o turno da noite por $R\$\;90,00$ + $R\$\;7,00$. Carlos dá 1 toque no botão de aceite (48px) com vibração haptic de confirmação. Ao final da noite, o lojista confirma a realização do turno e transfere o total acordado direto no PIX de Carlos.
  - **Climax:** Carlos recebe uma notificação comemorativa: *"Parabéns pelo corre! Você faturou R$ 160,00 100% livres de taxa."* Surge o Bottom Sheet comemorativo sugerindo doar R$ 2,00 via PIX para apoiar o servidor do deLIVREry.
  - **Resolution:** Carlos clica em [ 📋 Copiar PIX ], que copia a chave PIX estática do projeto (`pix@delivrery.app.br` / Payload BR Code mockado), abre o app do banco, transfere R$ 2,00 e ganha +25 XP e a badge *Apoiador da Comunidade*.
  - **Edge case:** Se Carlos tiver um imprevisto mecânico antes de iniciar, ele cancela a vaga com 1 toque; se o cancelamento ocorrer com >2h de antecedência, não sofre penalidade de XP.

- **UJ-2. Mariana (Dona de Pizzaria) salva a operação de chuva sem pagar comissão.**
  - **Persona + contexto:** Mariana, proprietária de uma pizzaria com 40 pedidos pendentes e um motoboy que faltou por causa da chuva.
  - **Entry state:** Acessa o painel web/PWA de lojista de sua região.
  - **Path:** Mariana clica em [ 🚨 Vaga de Emergência ], seleciona o turno das 19h às 23h, e o sistema sugere a mediana calibrada com bônus de chuva ($R\$\;100,00$). Ela confirma a publicação. Em 3 minutos, um entregador Nível Ouro a 1.2km aceita a chamada.
  - **Climax:** Às 23h30, todas as pizzas foram entregues no prazo. Mariana avalia o motoboy com 5 estrelas e confirma o pagamento direto.
  - **Resolution:** O sistema exibe o cálculo de economia: *"Você economizou R$ 84,00 em comissões que pagaria a apps tradicionais hoje!"* Mariana clica em [ Doar R$ 5,00 ] copiando a chave PIX instantânea.

- **UJ-3. Gestor de TI da Prefeitura integra a plataforma ao Portal Municipal de sua Cidade.**
  - **Persona + contexto:** Rodrigo, desenvolvedor líder da plataforma digital de um município brasileiro.
  - **Entry state:** Acessa o Portal do Desenvolvedor (`/developers`).
  - **Path:** Rodrigo cadastra a organização municipal, gera uma API Key com escopo geográfico delimitado pela sua cidade (`city_id`), e configura uma URL de Webhook para o evento `job.completed`.
  - **Climax:** Rodrigo incorpora o widget `<delivrery-button />` no portal de apoio ao comércio local da prefeitura. Os restaurantes cadastrados no portal municipal passam a emitir pedidos de motoboy que são atendidos pela frota regional do deLIVREry em tempo real.
  - **Resolution:** O município fomenta a renda de centenas de famílias autônomas sem custo de software ou licença.

---

## 3. Glossary

- **Core Engine:** A API RESTful desacoplada e o conjunto de Edge Functions e regras de negócio hospedadas no Supabase que orquestram vagas, matching, reputação e precificação.
- **Delight Moment:** Ponto de alta satisfação ou alívio emocional e financeiro na jornada do usuário (ex: turno concluído sem taxas, emergência salva em <5min) onde é solicitada uma microdoação voluntária PIX.
- **Balizador Bid/Ask:** Painel analítico regional em tempo real que calcula e exibe a mediana ($P_{med}$), valor mínimo ($P_{min}$) e valor máximo ($P_{max}$) praticados nas transações confirmadas da localidade.
- **Filtro 1.5×IQR:** Algoritmo estatístico de Desvio Interquartil (Interquartile Range) que expurga ofertas anômalas ou fraudulentas para impedir distorção artificial do balizador de preços.
- **Trava de Velocidade:** Regra anti-manipulação que limita a alteração de tarifas base de um perfil em no máximo $\pm 30\%$ em um intervalo móvel de 12 horas.
- **Gatilho de Desbloqueio Regional:** Limiar numérico mínimo de densidade local (padrão: 10 lojistas ativos e 50 entregadores cadastrados em raio de 3km) para transicionar qualquer bairro/cidade do Brasil de *Pré-Lançamento* para *Operação Ativa*.
- **Termômetro de Desbloqueio:** Indicador visual no PWA/Landing Pages que exibe o percentual de quórum atingido para a ativação do bairro selecionado e incentiva a indicação viral.
- **Magic Link:** Mecanismo de autenticação sem senha (*passwordless*) onde o usuário recebe um token seguro por e-mail para acesso persistente.
- **Microdoação PIX:** Contribuição financeira voluntária não-obrigatória, realizada através de Chave PIX Estática Copia e Cola, destinada à manutenção dos servidores e evolução da plataforma.
- **Modal:** Meio de locomoção do entregador (Motocicleta, Bicicleta convencional, Bicicleta elétrica / Patinete).

---

## 4. Features

### 4.1 Autenticação e Perfis Desacoplados (Headless & PWA)
**Description:** Sistema de autenticação sem fricção para usuários finais via Magic Link persistente no PWA e autenticação robusta para parceiros integradores via API Keys escopadas geograficamente por município. Realiza UJ-1, UJ-3.

**Functional Requirements:**

#### FR-1: Autenticação Passwordless de Usuários Finais
O sistema deve permitir login e criação de conta de Entregadores e Lojistas via Magic Link enviado por e-mail, mantendo a sessão persistente no Supabase Auth com suporte a IndexedDB/LocalStorage. Realiza UJ-1, UJ-2.
**Consequences (testable):**
- O envio do Magic Link ocorre em tempo de resposta $<2\text{s}$.
- Ao clicar no link de autenticação, o PWA recupera e armazena os tokens de sessão JWT de forma persistente, mesmo se o navegador for reiniciado ou fechado.
- Se o e-mail não estiver cadastrado, o fluxo direciona automaticamente para a complementação cadastral (CPF, Telefone, Modal/Endereço, Estado/Cidade/Bairro).

#### FR-2: Validação Rigorosa e Cobertura Geográfica Universal
O sistema deve validar os dígitos verificadores de CPF, formato de e-mail e telefone móvel com DDD em qualquer Estado e Município do Brasil, impedindo duplicidade no banco de dados.
**Consequences (testable):**
- Tentativa de cadastro com CPF inválido retorna erro `422 Unprocessable Entity` com mensagem descritiva.
- O formulário de cadastro e as Landing Pages carregam dinamicamente a árvore de Estados (UF), Cidades (`city_id`) e Bairros (`neighborhood_id`) de todo o Brasil.

#### FR-3: Gestão e Emissão de Chaves de API para Parceiros (API Keys)
O sistema deve permitir que desenvolvedores e parceiros integradores gerem credenciais de API (`client_id` e `api_key`) com restrição de escopo geográfico (`allowed_cities`). Realiza UJ-3.
**Consequences (testable):**
- Requisições com header `X-API-Key` inválido ou revogado recebem retorno `HTTP 401 Unauthorized`.
- Requisições com escopo de cidade fora da lista `allowed_cities` do tenant recebem `HTTP 403 Forbidden`.

---

### 4.2 Publicação de Vagas, Matching e Leilão Bid/Ask
**Description:** Mecanismo de publicação de turnos de trabalho, matching geolocalizado e negociação direta de valores entre lojistas e entregadores em qualquer região. Realiza UJ-1, UJ-2.

**Functional Requirements:**

#### FR-4: Publicação de Vaga / Turno de Trabalho
Lojistas autenticados podem publicar vagas de entrega especificando data/hora do turno, valor base da diária ofertada, taxa fixa por entrega e modal aceito na sua região. Realiza UJ-2.
**Consequences (testable):**
- A vaga criada passa ao status `open` e emite notificações via Web Push FCM para entregadores com modal compatível cadastrados naquele bairro/cidade em $<3\text{s}$.
- A publicação de vaga com mais de 48h de antecedência credita automaticamente $+50\text{ XP}$ ao lojista.

#### FR-5: Envio e Aceite de Proposta / Contraproposta (Bid/Ask)
Entregadores podem aceitar a vaga pelo valor anunciado ou submeter uma contraproposta de diária/taxa. O lojista pode aceitar a contraproposta com 1 clique, consolidando o matching e fechando a vaga (`status: matched`). Realiza UJ-1, UJ-2.
**Consequences (testable):**
- Ao aceitar uma proposta, todas as contrapropostas concorrentes para aquela mesma vaga têm seu status alterado para `rejected`.
- O lojista e o entregador recebem o contato telefônico e identificação direta um do outro no PWA para alinhamento operacional.
- O cancelamento injustificado com $<2\text{h}$ do início do turno deduz $50\text{ XP}$ do cancelador.

#### FR-6: Filtro e Compatibilidade por Modal de Transporte
O sistema deve direcionar vagas exclusivamente para entregadores cujos modais cadastrados sejam compatíveis com o raio e o perfil de entrega da loja (ex: ciclistas apenas para chamadas com raio $\le 3\text{km}$).
**Consequences (testable):**
- Vagas categorizadas como de longo alcance ($>5\text{km}$) não são listadas para entregadores com modal cadastrado como bicicleta convencional.

---

### 4.3 Balizador Regional de Preços e Inteligência Anti-Manipulação
**Description:** Algoritmo estatístico que processa em tempo real as transações concluídas por micro-região e fornece parâmetros públicos de referência, blindado contra manipulações. Realiza UJ-1, UJ-2.

**Functional Requirements:**

#### FR-7: Cálculo Dinâmico de $P_{min}, P_{med}, P_{max}$ Regional
O sistema deve calcular periodicamente a mediana, valor mínimo e valor máximo praticados para cada par `city_id` e `neighborhood_id`, expondo os dados no PWA e via endpoint `/api/v1/analytics/pricing-stats`.
**Consequences (testable):**
- Transações com status `completed` e confirmadas por ambas as partes são computadas na agregação estatística em tempo de latência $<100\text{ms}$.
- Consultas ao endpoint retornam JSON estruturado com os três parâmetros e o volume de transações da amostra regional.

#### FR-8: Expulgo de Outliers via Filtro 1.5×IQR
O motor analítico deve eliminar do cálculo público de preços qualquer valor que esteja fora do intervalo $[Q_1 - 1.5 \times \text{IQR}, Q_3 + 1.5 \times \text{IQR}]$.
**Consequences (testable):**
- Uma oferta anômala simulada (ex: diária de R$ 1.000,00 ou R$ 1,00) não altera os valores de $P_{med}$ expostos para a comunidade.

#### FR-9: Trava de Velocidade Tarifária (Rate Limiting de Preços)
O sistema deve bloquear alterações no valor base padrão do perfil do entregador ou lojista que excedam $\pm 30\%$ em uma janela móvel de 12 horas.
**Consequences (testable):**
- Tentativa de subir a diária base de R$ 80,00 para R$ 150,00 em menos de 12h retorna erro `400 Bad Request` informando o limite máximo permitido para o período.

---

### 4.4 Sustentabilidade por Microdoações PIX (Delight Moments)
**Description:** Sistema de financiamento comunitário sem comissões obrigatórias, acionado estrategicamente por microdoações PIX Copia e Cola via Chave Estática em momentos de alta satisfação. Realiza UJ-1, UJ-2.

**Functional Requirements:**

#### FR-10: Disparo do Modal de Microdoação nos 5 Delight Moments
O sistema deve acionar o componente de doação (Bottom Sheet / Modal flutuante) exclusivamente nos 5 momentos mapeados:
1. *Entregador:* Ao ter o pagamento confirmado pelo lojista ao final do turno.
2. *Entregador:* Ao subir de nível no sistema de gamificação.
3. *Lojista:* Ao ter uma vaga de emergência aceita em $<5$ minutos.
4. *Lojista:* Ao avaliar um entregador com 5 estrelas pós-turno.
5. *Parceiro API:* Ao completar 1.000 requisições de sucesso no mês.
Realiza UJ-1, UJ-2, UJ-3.
**Consequences (testable):**
- O modal surge suavemente sem bloquear a tela de forma punitiva e com opção clara de fechar em 1 clique (`[ Agora Não ]`).
- Exibe chips de valores rápidos: `[ R$ 2,00 ]`, `[ R$ 5,00 ]`, `[ R$ 10,00 ]` e `[ Outro Valor ]`.

#### FR-11: Chave PIX Estática Mockada e Cópia em 1 Clique
Ao selecionar o valor ou clicar em [ 📋 Copiar Código PIX ], o sistema injeta o payload BR Code da Chave PIX Estática (`pix@delivrery.app.br` / mock configurável) na área de transferência do dispositivo com vibração tátil (*Haptic Feedback*) e toast informativo. Realiza UJ-1.
**Consequences (testable):**
- O payload copiado é padronizado e compatível com leitura de qualquer aplicativo bancário nacional.
- O evento de cópia é registrado anonimamente na tabela `donations_log` para análise de métricas de conversão.
- Concede instantaneamente $+25\text{ XP}$ e a badge de *Apoiador da Comunidade* ao usuário no primeiro apoio do mês.

#### FR-12: Painel Público de Transparência do Custo do Servidor
O sistema deve disponibilizar um indicador público de arrecadação comunitária vs. custo real mensal de infraestrutura (Supabase, FCM, hospedagem), promovendo transparência total.
**Consequences (testable):**
- O atingimento de 100% da meta do mês ativa visual comemorativo de *Vitória Coletiva* no rodapé do PWA.

---

### 4.5 Desbloqueio Orgânico Regional e Gamificação Viral
**Description:** Dinâmica de expansão territorial e engajamento orientada por quórum hiperlocal e sistema de pontuação por XP para qualquer bairro do Brasil. Realiza UJ-1.

**Functional Requirements:**

#### FR-13: Termômetro de Desbloqueio Universal
O sistema deve rastrear o número de lojistas e entregadores cadastrados em cada micro-região brasileira. Regiões com menos de 10 lojas e 50 entregadores operam em status `pre_launch`, exibindo a barra de progresso no PWA e nas Landing Pages.
**Consequences (testable):**
- Ao atingir a marca de 10 lojas e 50 entregadores na localidade, a região transiciona automaticamente para `is_unlocked = true` e o sistema dispara Web Push e Webhooks para toda a base daquele bairro.

#### FR-14: Motor de XP e Níveis de Gamificação
O sistema deve conceder pontos de XP e elevar o nível dos usuários conforme a tabela oficial de ações (Concluir turno: $+50\text{ XP}$; Publicar vaga $>48\text{h}$: $+50\text{ XP}$; Avaliação 5 estrelas: $+20\text{ XP}$; Indicação qualificada: $+100\text{ XP}$).
**Consequences (testable):**
- Usuários que atingem os níveis Prata e Ouro ganham destaque prioritário visual no balizador e listagens de vagas.

#### FR-15: Link Exclusivo de Indicação Viral (`referral_code`)
Cada entregador e lojista cadastrado possui um link exclusivo de indicação. Cadastros originados desse link contabilizam pontos de avanço direto no termômetro do bairro do indicador. Realiza UJ-1.
**Consequences (testable):**
- O acesso via link de indicação preenche automaticamente o código no formulário de pré-cadastro.

---

### 4.6 Integrações Headless, Webhooks e Developer Portal
**Description:** Infraestrutura para consumo por terceiros via API REST, Webhooks de eventos e componentes web embutíveis. Realiza UJ-3.

**Functional Requirements:**

#### FR-16: Endpoints de Gestão Headless de Vagas e Perfis
A API deve expor rotas RESTful para cadastro (`POST /api/v1/couriers`, `POST /api/v1/stores`), listagem georreferenciada (`GET /api/v1/jobs?city_id=...`) e matching (`POST /api/v1/bids/:id/accept`). Realiza UJ-3.
**Consequences (testable):**
- Todas as rotas respondem em formato JSON padrão em conformidade com especificação OpenAPI 3.0.

#### FR-17: Disparo de Webhooks de Saída Assinados
O sistema deve disparar notificações HTTP POST em tempo real para URLs cadastradas por parceiros integradores para os eventos `job.created`, `bid.submitted`, `job.accepted` e `job.completed`. Realiza UJ-3.
**Consequences (testable):**
- Cada requisição de Webhook inclui cabeçalho `X-Signature-SHA256` calculado com o `secret_token` do parceiro para verificação criptográfica de autenticidade.
- Se o endpoint do parceiro falhar com erro 5xx, o sistema realiza até 3 retentativas com backoff exponencial.

#### FR-18: Componente Web Embutível (`<delivrery-button />`)
O projeto deve disponibilizar um Web Component leve em JavaScript puro que qualquer cardápio digital ou sistema web pode embutir com 1 tag HTML para acionar entregadores locais. Realiza UJ-3.
**Consequences (testable):**
- O componente renderiza em $<50\text{ms}$ sem dependências externas de bibliotecas pesadas.

---

## 5. Non-Goals (Explicit)

- **Processamento Centralizado de Pagamentos:** O deLIVREry não é gateway de pagamento e não fará custódia (*split*) ou liquidação financeira de corridas. Todo pagamento é feito de ponta a ponta (P2P) entre lojista e motoboy.
- **Catálogo de Pratos e E-commerce B2C:** O sistema não conterá menu de pratos, fotos de alimentos, avaliações de comida ou carrinho de compras para o consumidor final na v1.
- **Cobrança de Mensalidades ou Taxas de API:** O deLIVREry nunca cobrará taxas por requisição de API ou mensalidades de lojistas/entregadores.
- **Rastreamento Contínuo por GPS em Background fora de Turno:** O sistema não monitorará a localização do entregador fora do horário de turno ativo, respeitando a privacidade e a bateria do profissional.

---

## 6. MVP Scope (Sprint 1)

### 6.1 In Scope
- **Landing Pages Universais para Entregadores (Testes A/B/C):** 3 variantes de copy (Racional/Lucro, Comunitária/Liberdade, Vagas/Escassez) com formulário de captura de pré-cadastro, seleção dinâmica de Estado/Cidade/Bairro de todo o Brasil e termômetro regional de desbloqueio.
- **Landing Page Universal para Lojistas:** Foco em eliminar custos com intermediários e garantir cobertura de motoboys em qualquer região do país.
- **Portal do Desenvolvedor (`/developers`):** Playground interativo (Swagger UI / OpenAPI), emissão autônoma de API Keys de teste e produção e cadastro de Webhooks com segredo HMAC.
- **Core Engine API (Supabase REST + Edge Functions):** Endpoints essenciais de cadastro, publicação de vagas, submissão de bids, aceite e balizador básico de preços.
- **PWA Mobile-First Inicial:** Interface responsiva para testes de fluxo de aceitação de vagas e modal de doação PIX com Chave Estática Mockada e botão [ Copiar Código ].

### 6.2 Out of Scope for MVP (Diferidos para v2 / v3)
- Roteirização multi-parada com otimização avançada de frotas (v2).
- Robô assistente de áudio para WhatsApp/Telegram via IA (v2).
- Módulo de fundos comunitários para bolsas open source (v3).

---

## 7. Success Metrics

### Primary Metrics
- **SM-1 (Taxa de Conversão das Landing Pages):** $\ge 25\%$ dos visitantes convertendo em pré-cadastros válidos (CPF verificado) durante a Sprint 1. *Valida FR-1, FR-2.*
- **SM-2 (Tempo de Aceite de Vagas em Bairros Ativos):** Mediana de tempo de aceite de vagas de emergência $< 5$ minutos em polos desbloqueados. *Valida FR-4, FR-5.*
- **SM-3 (Adoção da API Headless):** Pelo menos 2 portais ou sistemas de PDV parceiros consumindo ativamente a API nos primeiros 60 dias de operação. *Valida FR-3, FR-16, FR-17.*
- **SM-4 (Conversão de Microdoações PIX):** $\ge 5\%$ dos usuários atingidos por Delight Moments clicando em [ Copiar PIX ] para apoio financeiro voluntário. *Valida FR-10, FR-11.*

### Secondary Metrics
- **SM-5 (Retenção de Entregadores):** $\ge 70\%$ dos entregadores ativos completando pelo menos 3 turnos por semana após o desbloqueio do bairro. *Valida FR-5, FR-14.*
- **SM-6 (Acurácia Anti-Manipulação):** $0\%$ de ofertas fora do intervalo $1.5\times\text{IQR}$ influenciando os valores públicos do balizador. *Valida FR-7, FR-8, FR-9.*

### Counter-Metrics (Não Otimizar)
- **SM-C1 (Volume Bruto de Notificações Push):** Não enviar mais de 4 notificações diárias por entregador para evitar fadiga e desinstalação do PWA, mesmo que isso aumente a velocidade marginal de aceite. *Contrabalanceia SM-2.*
- **SM-C2 (Fricção no Modal de Doação):** Nunca exigir confirmação de doação ou travar a tela com contadores de tempo para forçar o PIX. A doação deve permanecer $100\%$ espontânea. *Contrabalanceia SM-4.*

---

## 8. Open Questions (Resolvidas)

1. **[OQ-1] Chave PIX do MVP (RESOLVIDA):** Utilizaremos Chave PIX Estática com payload BR Code Copia e Cola mockado (`pix@delivrery.app.br` / BR Code mock configurável), sem custos de API bancária no MVP, facilitando a substituição posterior via variável de ambiente.
2. **[OQ-2] Abrangência Geográfica e Landing Pages (RESOLVIDA):** A solução não é restrita a um único polo piloto; as Landing Pages, onboarding e APIs são universais para todo o Brasil desde o dia 1, permitindo seleção dinâmica de qualquer Estado/Cidade/Bairro com cálculo automático do termômetro de desbloqueio local.

---

## 9. Assumptions Index

- `[ASSUMPTION: §4.1 / FR-1]` O Supabase Auth com Magic Link fornece cota gratuita suficiente para suportar até 50.000 autenticações mensais sem gerar custo inicial de infraestrutura.
- `[ASSUMPTION: §4.3 / FR-8]` O volume mínimo de 15 transações concluídas por bairro em uma janela de 7 dias é suficiente para calcular o $1.5\times\text{IQR}$ com estabilidade estatística.
- `[ASSUMPTION: §4.4 / FR-10]` Uma taxa de conversão voluntária de $5\%$ com ticket médio de R$ 3,00 por doação cobre com sobras os custos mensais de servidores e tráfego do Supabase/FCM em escala local.
- `[ASSUMPTION: §4.5 / FR-13]` A densidade de 10 lojas e 50 entregadores em raio de 3km gera liquidez suficiente para garantir aceites de vagas em $<5$ minutos.
