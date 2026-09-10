-- ==============================================================================
-- Migration: 20260909210000_create_avatars_storage_bucket.sql
-- Description: Cria o bucket de armazenamento de avatares no Supabase Storage (CAP-2),
--              configura políticas de RLS e adiciona coluna avatar_url na tabela users.
-- Architecture: Hexagonal / Supabase PostgreSQL 15+ / Storage Engine
-- ==============================================================================

-- 1. Adiciona coluna avatar_url na tabela public.users
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- 2. Criação do bucket 'avatars' no esquema storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB (5 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Row Level Security (RLS) para storage.objects no bucket 'avatars'
-- SELECT: Leitura pública universal para que fotos de perfil sejam visualizadas em propostas e perfis
DROP POLICY IF EXISTS "Public Access to Avatars" ON storage.objects;
CREATE POLICY "Public Access to Avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- INSERT: Apenas o próprio usuário autenticado pode subir arquivos em sua pasta ({userId}/...)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- UPDATE: Apenas o próprio usuário autenticado pode alterar seus arquivos
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- DELETE: Apenas o próprio usuário autenticado pode remover seus arquivos de avatar
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
