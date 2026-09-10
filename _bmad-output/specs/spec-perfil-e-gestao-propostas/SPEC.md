---
id: SPEC-perfil-e-gestao-propostas
companions:
  - data-contracts.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Gestão de Perfil, Identidade Visual e Operação Hiperlocal de Propostas

## Why

Entregadores e lojistas no deLIVREry precisam de autonomia cadastral e identificação visual para construir confiança mútua antes e durante as operações, além de ferramentas de controle de jornada que evitem conflitos de agenda e sobrecarga operacional. Sem autonomia para editar dados, inserir fotos de identificação e pausar a recepção de pedidos, usuários enfrentam atrito de adoção; paralelamente, a ausência de controle contra sobreposição de turnos aceitos induz entregadores a faltas ou atrasos que comprometem a confiabilidade da rede hiperlocal.

## Capabilities

- **CAP-1**
  - **intent:** Usuário autenticado (entregador ou lojista) pode visualizar e atualizar seus dados cadastrais e operacionais para manter seu perfil atualizado.
  - **success:** A alteração de dados editáveis é persistida no banco e refletida instantaneamente na interface; alterações em dados protegidos/imutáveis (como CPF e tipo de conta) são bloqueadas.

- **CAP-2**
  - **intent:** Usuário pode carregar e atualizar sua foto de perfil para identificação visual na plataforma.
  - **success:** O upload de imagem válida armazena o arquivo no storage com URL persistida no perfil do usuário, exibindo o avatar atualizado nos pontos de contato do app.

- **CAP-3**
  - **intent:** Lojista pode visualizar a foto de perfil dos entregadores que submeteram propostas ou foram confirmados em suas vagas para identificação segura na operação.
  - **success:** Ao listar propostas recebidas para uma vaga e na visualização da vaga confirmada, o lojista visualiza o avatar do entregador correspondente (ou placeholder neutro na ausência de foto).

- **CAP-4**
  - **intent:** Entregador pode alternar seu status de disponibilidade operacional entre ativo e pausado para controlar quando deseja receber oportunidades e notificações.
  - **success:** Com o status inativo, o entregador não recebe disparos de notificações push de novas vagas e a interface sinaliza visualmente a pausa; ao alternar para ativo, as oportunidades voltam a ser notificadas normalmente.

- **CAP-5**
  - **intent:** Entregador tem filtradas e ocultadas vagas cujos horários de turno colidam com propostas de turnos que ele já aceitou e tem agendados.
  - **success:** A listagem de vagas abertas omite postagens cujo intervalo de turno (com acréscimo de 30 minutos de tolerância para deslocamento) intercepte o período de qualquer vaga já aceita pelo entregador, e qualquer tentativa de submeter proposta para um turno conflitante é rejeitada pelo sistema.

- **CAP-6**
  - **intent:** Usuário visualiza por padrão apenas oportunidades e propostas circunscritas ao bairro territorial no qual se registrou.
  - **success:** A listagem inicial de vagas abertas é filtrada estritamente pelo bairro cadastrado do usuário (`home_neighborhood_id` para entregador e `neighborhood_id` para lojista), ocultando turnos de outras localidades a menos que uma busca abrangente seja acionada intencionalmente.

## Constraints

- Identificadores civis (`cpf`), e-mail principal e tipo de conta (`user_type`) são imutáveis após o cadastro para integridade fiscal, jurídica e de auditoria.
- Preservação da regra AD-10 de privacidade: número de telefone e endereço pessoal de entregadores permanecem ocultos para o lojista até o momento da aceitação mútua da proposta, compartilhando antecipadamente apenas avatar, nome público, nível e XP.
- A detecção de colisão temporal de turnos deve ser avaliada matematicamente via sobreposição de intervalos em horário UTC (`timestamptz`), incorporando obrigatoriamente um buffer fixo de tolerância de 30 minutos entre turnos consecutivos para deslocamento do entregador.
- Alterações de bairro base do usuário no perfil devem executar atualização atômica e balanceada dos contadores territoriais de quórum na tabela `region_unlocks` (decremento no bairro de origem e incremento no bairro de destino).
- Imagens de perfil devem respeitar limites estritos de segurança: formatos `image/jpeg`, `image/png`, `image/webp` e tamanho máximo de 5MB por arquivo, armazenadas em bucket dedicado do Supabase Storage.

## Non-goals

- Validação biométrica facial automatizada, prova de vida ou reconhecimento facial por inteligência artificial durante o upload de foto.
- Implementação de visualizador de calendário mensal/semanal complexo ou sincronização bidirecional com Google Calendar/iCal externo.
- Suporte a múltiplos bairros residenciais simultâneos para um único cadastro de entregador no modelo territorial base.
- Edição retroativa de histórico imutável de avaliações, turnos concluídos ou métricas de XP já consolidadas.

## Success signal

- Um entregador com turno aceito das 18h00 às 22h00 no bairro Bela Vista consulta a lista de vagas e visualiza apenas vagas da Bela Vista com horários sem sobreposição com a janela de 17h30 às 22h30 (incluindo buffer); altera seu bairro cadastrado e o quórum de ambos os bairros é atualizado no banco; edita seu telefone e envia foto de perfil; o lojista visualiza imediatamente a foto do entregador na proposta recebida.

## Assumptions

- A relação entre a conta de autenticação (`auth.users`) e a identidade pública (`public.users`) é 1:1 e gerenciada via gatilhos de sessão.
- Apenas propostas com status `'accepted'` e vagas nos estados `'matched'` ou `'in_progress'` caracterizam compromisso confirmado causador de colisão temporal; propostas em análise ('pending') não bloqueiam a visualização de outros turnos.
- O bucket de Storage `avatars` possui políticas públicas de leitura (RLS SELECT) e escrita restrita ao proprietário autenticado (RLS INSERT/UPDATE/DELETE).
