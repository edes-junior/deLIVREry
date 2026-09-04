# deLIVREry — PRD Addendum (Deep Technical & Architecture Preservation)

Este documento preserva detalhes de arquitetura técnica, esquemas de banco de dados, assinaturas de API e especificações de segurança que complementam o [prd.md](file:///c:/Users/edes.junior/deLIVREry/_bmad-output/planning-artifacts/prds/prd-deLIVREry-2026-08-21/prd.md) sem poluir a narrativa funcional de produto.

---

## 1. Configuração da Chave PIX Estática (Mockada no MVP)

### 1.1 Variáveis de Ambiente
- `PUBLIC_PIX_KEY`: `pix@delivrery.app.br` (Chave PIX e-mail mockada)
- `PUBLIC_PIX_RECIPIENT_NAME`: `DELIVRERY BRASIL`
- `PUBLIC_PIX_CITY`: `SAO PAULO`
- `PUBLIC_PIX_BRCODE_PAYLOAD`: `00020126580014br.gov.bcb.pix0136pix@delivrery.app.br5204000053039865802BR5916DELIVRERY BRASIL6009SAO PAULO62070503***6304A1B2`

---

## 2. Esquema de Banco de Dados Relacional (Supabase / PostgreSQL)

### 2.1 Tabela: `api_clients` (Tenants Integradores)
- `id` (UUID, PK, default `gen_random_uuid()`)
- `client_name` (TEXT NOT NULL)
- `api_key_hash` (TEXT NOT NULL UNIQUE)
- `owner_email` (TEXT NOT NULL)
- `allowed_cities` (TEXT[] NOT NULL DEFAULT '{"*"}') -- `{"*"}` para acesso nacional irrestrito
- `rate_limit_rpm` (INT NOT NULL DEFAULT 120)
- `is_active` (BOOLEAN NOT NULL DEFAULT true)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### 2.2 Tabela: `webhooks_subscriptions` (Subscrições de Eventos)
- `id` (UUID, PK)
- `client_id` (UUID REFERENCES `api_clients(id)`)
- `target_url` (TEXT NOT NULL)
- `event_type` (TEXT NOT NULL) -- `job.created`, `bid.submitted`, `job.accepted`, `job.completed`
- `secret_token` (TEXT NOT NULL)
- `is_active` (BOOLEAN NOT NULL DEFAULT true)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### 2.3 Tabela: `users` (Usuários Base)
- `id` (UUID, PK, FK `auth.users.id`)
- `cpf` (VARCHAR(11) NOT NULL UNIQUE)
- `email` (TEXT NOT NULL UNIQUE)
- `phone_number` (VARCHAR(15) NOT NULL)
- `user_type` (VARCHAR(10) NOT NULL CHECK (`user_type` IN ('courier', 'store')))
- `origin_client_id` (UUID NULL REFERENCES `api_clients(id)`)
- `created_at` (TIMESTAMPTZ DEFAULT now())

### 2.4 Tabela: `courier_profiles` (Entregadores)
- `user_id` (UUID, PK REFERENCES `users(id)`)
- `transport_modal` (VARCHAR(15) NOT NULL CHECK (`transport_modal` IN ('motorcycle', 'bicycle', 'ebike_scooter')))
- `base_daily_rate` (DECIMAL(10,2) NOT NULL)
- `base_delivery_fee` (DECIMAL(10,2) NOT NULL)
- `xp_points` (INT NOT NULL DEFAULT 0)
- `level` (VARCHAR(15) NOT NULL DEFAULT 'Bronze')
- `referral_code` (VARCHAR(20) NOT NULL UNIQUE)
- `referred_by_id` (UUID NULL REFERENCES `users(id)`)
- `home_neighborhood_id` (TEXT NOT NULL)
- `city_id` (TEXT NOT NULL)
- `state_id` (VARCHAR(2) NOT NULL)
- `rate_updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### 2.5 Tabela: `store_profiles` (Lojistas)
- `user_id` (UUID, PK REFERENCES `users(id)`)
- `store_name` (TEXT NOT NULL)
- `address_street` (TEXT NOT NULL)
- `address_lat` (DECIMAL(9,6) NOT NULL)
- `address_lng` (DECIMAL(9,6) NOT NULL)
- `neighborhood_id` (TEXT NOT NULL)
- `city_id` (TEXT NOT NULL)
- `state_id` (VARCHAR(2) NOT NULL)
- `reputation_score` (DECIMAL(3,2) NOT NULL DEFAULT 5.00)
- `is_supporter` (BOOLEAN NOT NULL DEFAULT false)

### 2.6 Tabela: `job_posts` (Vagas e Turnos)
- `id` (UUID, PK)
- `store_id` (UUID REFERENCES `store_profiles(user_id)`)
- `neighborhood_id` (TEXT NOT NULL)
- `city_id` (TEXT NOT NULL)
- `origin_client_id` (UUID NULL REFERENCES `api_clients(id)`)
- `shift_start_time` (TIMESTAMPTZ NOT NULL)
- `shift_end_time` (TIMESTAMPTZ NOT NULL)
- `offered_daily_rate` (DECIMAL(10,2) NOT NULL)
- `offered_delivery_fee` (DECIMAL(10,2) NOT NULL)
- `accepted_modal` (TEXT[] NOT NULL DEFAULT '{"motorcycle"}')
- `status` (VARCHAR(15) NOT NULL DEFAULT 'open' CHECK (`status` IN ('open', 'matched', 'in_progress', 'completed', 'cancelled')))
- `created_at` (TIMESTAMPTZ DEFAULT now())

### 2.7 Tabela: `job_bids` (Propostas / Contrapropostas)
- `id` (UUID, PK)
- `job_id` (UUID REFERENCES `job_posts(id)`)
- `courier_id` (UUID REFERENCES `courier_profiles(user_id)`)
- `bid_daily_rate` (DECIMAL(10,2) NOT NULL)
- `bid_delivery_fee` (DECIMAL(10,2) NOT NULL)
- `status` (VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (`status` IN ('pending', 'accepted', 'rejected', 'withdrawn')))
- `created_at` (TIMESTAMPTZ DEFAULT now())

### 2.8 Tabela: `region_unlocks` (Status de Bairros no Brasil)
- `id` (UUID, PK)
- `state_id` (VARCHAR(2) NOT NULL)
- `city_id` (TEXT NOT NULL)
- `neighborhood_id` (TEXT NOT NULL)
- `neighborhood_name` (TEXT NOT NULL)
- `couriers_count` (INT NOT NULL DEFAULT 0)
- `stores_count` (INT NOT NULL DEFAULT 0)
- `is_unlocked` (BOOLEAN NOT NULL DEFAULT false)
- `unlocked_at` (TIMESTAMPTZ NULL)

### 2.9 Tabela: `donations_log` (Microdoações PIX em Delight Moments)
- `id` (UUID, PK)
- `user_id` (UUID NULL REFERENCES `users(id)`)
- `trigger_moment` (VARCHAR(50) NOT NULL)
- `suggested_amount` (DECIMAL(10,2) NOT NULL)
- `copied_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

---

## 3. Especificação do Algoritmo Anti-Manipulação de Preços (IQR)

O cálculo das estatísticas de mercado regionais ($P_{min}, P_{med}, P_{max}$) é executado via Edge Function com a seguinte rotina matemática:

1. **Amostragem:** Selecionar todas as transações finalizadas (`job_posts.status = 'completed'`) para o par `(city_id, neighborhood_id)` nos últimos 14 dias (mínimo de 10 amostras).
2. **Cálculo dos Quartis:**
   - $Q_1$: 25º percentil dos valores de diária e taxa por entrega.
   - $Q_3$: 75º percentil.
   - $\text{IQR} = Q_3 - Q_1$.
3. **Limites de Expulgo:**
   - $\text{Limite Inferior} = \max(0, Q_1 - 1.5 \times \text{IQR})$
   - $\text{Limite Superior} = Q_3 + 1.5 \times \text{IQR}$
4. **Agregação Limpa:** Apenas valores contidos no intervalo $[\text{Limite Inferior}, \text{Limite Superior}]$ alimentam o cálculo de:
   - $P_{min} = \min(\text{amostras limpas})$
   - $P_{med} = \text{mediana}(\text{amostras limpas})$
   - $P_{max} = \max(\text{amostras limpas})$

---

## 4. Segurança e Assinatura de Webhooks

Para todo evento despachado aos parceiros, o deLIVREry calcula uma assinatura HMAC-SHA256:

```http
POST https://api.parceiro.com.br/webhooks/delivrery
Content-Type: application/json
X-Signature-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
X-Delivery-Event: job.accepted
X-Delivery-Timestamp: 1787332400

{
  "event_id": "evt_9831a48c",
  "event_type": "job.accepted",
  "timestamp": "2026-08-21T18:45:00Z",
  "data": {
    "job_id": "job_398a12",
    "store_id": "usr_9981a",
    "courier_id": "usr_1120b",
    "agreed_daily_rate": 90.00,
    "agreed_delivery_fee": 7.00,
    "shift_start": "2026-08-21T19:00:00Z",
    "city_id": "sao_paulo",
    "neighborhood_id": "pinheiros"
  }
}
```

---

## 5. Política de Rate Limiting por Tenant

| Tipo de Cliente | Escopo Geográfico | Limite de Requisições (RPM) | Burst Permitido |
| :--- | :--- | :--- | :--- |
| **PWA Oficial** | Nacional | Sem limite (Sessão de Usuário Autenticado) | 300 req / 10s |
| **Parceiro Integrador (Free)** | Cidades autorizadas (`allowed_cities`) | 120 req / min | 30 req / 5s |
| **Portal Municipal / PDV Enterprise** | Cidades autorizadas | 600 req / min | 100 req / 5s |
