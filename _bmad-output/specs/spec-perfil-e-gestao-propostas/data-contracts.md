# Contratos de Dados e Regras Operacionais

Companion normativo para a especificação `SPEC-perfil-e-gestao-propostas`.

## 1. Alterações no Esquema Relacional (PostgreSQL / Supabase)

### Tabela `public.users`
- `avatar_url` (`VARCHAR(500) NULL`): URL pública ou referencial da foto de perfil no Supabase Storage.

### Tabela `public.courier_profiles`
- `is_active` (`BOOLEAN NOT NULL DEFAULT true`): Indicador de disponibilidade operacional do entregador para receber propostas e notificações push de novas vagas.

---

## 2. Configuração de Storage (`avatars`)

- **Bucket**: `avatars` (público para leitura de imagens validadas).
- **Tipos MIME permitidos**: `image/jpeg`, `image/png`, `image/webp`.
- **Tamanho Máximo**: 5 MB por arquivo.
- **Estrutura de Path**: `{user_id}/avatar.{ext}` (garante sobrescrita e unicidade por usuário).
- **RLS Storage**:
  - `INSERT` / `UPDATE` / `DELETE`: permitido apenas se `auth.uid() = (storage.foldername(name))[1]::uuid`.
  - `SELECT`: leitura pública para visualização do avatar em propostas e perfis.

---

## 3. Algoritmo e Regra de Detecção de Colisão Temporal com Buffer de Deslocamento

Para garantir que o entregador consiga se deslocar com segurança entre diferentes turnos, aplica-se uma **tolerância/buffer fixo de 30 minutos** antes e após cada turno agendado.

Dois turnos $A$ e $B$ colidem se, e somente se, houver interseção temporal considerando o buffer de 30 minutos:

$$\text{Intervalo}(X) = [X.\text{shift\_start\_time} - 30\text{min},\; X.\text{shift\_end\_time} + 30\text{min}]$$

$$\text{Colisão}(A, B) \iff (A.\text{shift\_start\_time} < B.\text{shift\_end\_time} + 30\text{min}) \land (A.\text{shift\_end\_time} > B.\text{shift\_start\_time} - 30\text{min})$$

### Regras de Negócio:
1. **Compromissos Considerados**: Apenas vagas onde o entregador possui proposta aceita (`job_bids.status = 'accepted'`) ou status de vaga `'matched'` / `'in_progress'`. Propostas meramente pendentes ou rejeitadas não geram bloqueio.
2. **Listagem Pública (`listOpenJobs`)**: Quando o usuário autenticado for um entregador, a query/filtro deve excluir automaticamente vagas que colidam (com a tolerância de 30 min) com sua agenda aceita.
3. **Barreira de Ingestão (`createJobBid`)**: Caso o entregador tente submeter proposta para uma vaga conflitante (via API direta ou concorrência), a operação é rejeitada com código `SCHEDULE_CONFLICT`.

---

## 4. Matriz de Privacidade e Visibilidade (AD-10)

| Dado do Entregador | Visibilidade para Lojista (Proposta Pendente) | Visibilidade para Lojista (Turno Aceito / Matched) | Visibilidade Pública |
| :--- | :--- | :--- | :--- |
| `avatar_url` | **Visível** | **Visível** | Não |
| `full_name` | **Visível** (Primeiro nome + inicial) | **Visível** (Nome completo) | Não |
| `level` / `xp_points` | **Visível** | **Visível** | Não |
| `transport_modal` | **Visível** | **Visível** | Não |
| `phone_number` | **Oculto** | **Visível** (Apenas após match) | Não |
| `cpf` | **Oculto** | **Oculto** | Não |

---

## 5. Regra de Filtro Hiperlocal e Migração de Quórum Territorial

1. **Filtro Padrão de Visualização**:
   - **Entregador**: Consultas de vagas abertas aplicam por padrão `job_posts.neighborhood_id = courier_profiles.home_neighborhood_id`, `city_id = courier_profiles.city_id` e `state_id = courier_profiles.state_id`.
   - **Lojista**: Consultas de vagas aplicam por padrão `store_profiles.neighborhood_id`.
2. **Sincronização Dinâmica de Quórum (`region_unlocks`)**:
   - Ao alterar o bairro base no perfil (`home_neighborhood_id` em entregadores ou `neighborhood_id` em lojistas), o sistema executa atualização transacional:
     - Decrementa em 1 a contagem (`couriers_count` ou `stores_count`) do bairro de origem em `region_unlocks`.
     - Incrementa em 1 a contagem correspondente no bairro de destino em `region_unlocks`.
     - Reavalia a regra de desbloqueio (`is_unlocked = true` se $\ge 50$ entregadores e $\ge 10$ lojas) no novo bairro.
