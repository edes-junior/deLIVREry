-- ==============================================================================
-- Migration: 20260904150000_auth_user_sync_trigger.sql
-- Description: Sincronização automática entre auth.users (Supabase Auth) e public.users.
--              Ajusta cpf e user_type para permitir cadastro progressivo (Story 1.2 -> Story 1.3).
-- ==============================================================================

-- 1. Ajuste de nulidade para suporte a cadastro progressivo (Magic Link primeiro, perfil depois)
ALTER TABLE public.users ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN user_type DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;

-- 2. Atualização das constraints para permitir NULL durante o onboarding progressivo
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_cpf_format;
ALTER TABLE public.users ADD CONSTRAINT check_cpf_format 
    CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$|^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_type;
ALTER TABLE public.users ADD CONSTRAINT check_user_type 
    CHECK (user_type IS NULL OR user_type IN ('courier', 'store'));

-- 3. Função de sincronização com auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger disparado na criação de novo usuário autenticado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();
