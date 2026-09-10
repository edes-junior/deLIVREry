/**
 * @file avatar-service.ts
 * @description Serviço de domínio para validação, upload e gerenciamento de fotos de perfil (Story 2 / CAP-2).
 * Integra com Supabase Storage (bucket 'avatars') com políticas de RLS e limite de 5MB.
 */

import { supabase } from '../lib/supabase.ts';

export const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
}

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

export class AvatarService {
  /**
   * Valida se o arquivo de avatar cumpre os requisitos de formato e tamanho máximo (5MB).
   */
  public static validateAvatarFile(file: { type: string; size: number } | null | undefined): AvatarValidationResult {
    if (!file) {
      return { valid: false, error: 'Nenhum arquivo foi selecionado.' };
    }

    if (!file.type || !ALLOWED_AVATAR_MIME_TYPES.includes(file.type.toLowerCase())) {
      return { 
        valid: false, 
        error: 'Formato de imagem inválido. Utilize arquivos JPG, PNG ou WebP.' 
      };
    }

    if (file.size <= 0) {
      return { valid: false, error: 'O arquivo selecionado está corrompido ou vazio.' };
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return { 
        valid: false, 
        error: 'A imagem deve ter no máximo 5MB.' 
      };
    }

    return { valid: true };
  }

  /**
   * Executa o upload da foto para o bucket 'avatars' no Supabase Storage e persiste a URL no perfil do usuário.
   */
  public static async uploadUserAvatar(
    userId: string,
    file: File | Blob | any,
    client: any = supabase
  ): Promise<AvatarUploadResult> {
    if (!userId || !userId.trim()) {
      return { success: false, error: 'Identificador do usuário é obrigatório.' };
    }

    const validation = this.validateAvatarFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Determina extensão a partir do tipo MIME
      const mime = file.type?.toLowerCase() || 'image/jpeg';
      const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

      // Upload para o bucket 'avatars' com upsert
      const { error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: mime
        });

      if (uploadError) {
        return { success: false, error: `Falha no envio da imagem: ${uploadError.message}` };
      }

      // Obtém a URL pública do avatar
      const { data: urlData } = client.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl || '';

      if (!publicUrl) {
        return { success: false, error: 'Não foi possível gerar a URL pública da foto de perfil.' };
      }

      // Atualiza a coluna avatar_url na tabela public.users
      const { error: dbError } = await client
        .from('users')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) {
        return { success: false, error: `Foto enviada, mas falhou ao atualizar o perfil: ${dbError.message}` };
      }

      return {
        success: true,
        avatarUrl: publicUrl
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Erro inesperado durante o upload do avatar.'
      };
    }
  }

  /**
   * Remove a foto de perfil do usuário (restaura avatar padrão).
   */
  public static async removeUserAvatar(
    userId: string,
    client: any = supabase
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Identificador do usuário é obrigatório.' };
    }

    try {
      const { error: dbError } = await client
        .from('users')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) {
        return { success: false, error: dbError.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
