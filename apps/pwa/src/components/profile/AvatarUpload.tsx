/**
 * @file AvatarUpload.tsx
 * @description Componente de upload de foto de perfil com preview em tempo real e tratamento de erros (Story 2 / CAP-2).
 * Integra com AvatarService para validação de tipo MIME, limite de 5MB e persistência no Supabase Storage.
 */

import React, { useState, useRef } from 'react';
import { Camera, Loader2, AlertTriangle } from 'lucide-react';
import { Avatar } from '../ui/Avatar.tsx';
import { AvatarService } from '../../profile/avatar-service.ts';

export interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName?: string;
  userType?: 'courier' | 'store';
  onAvatarUploaded: (newUrl: string) => void;
  disabled?: boolean;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  userId,
  currentAvatarUrl,
  userName = '',
  userType = 'courier',
  onAvatarUploaded,
  disabled = false
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validação estrita
    const validation = AvatarService.validateAvatarFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Arquivo inválido.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Preview local imediato
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);

    try {
      const result = await AvatarService.uploadUserAvatar(userId, file);
      if (result.success && result.avatarUrl) {
        setPreviewUrl(result.avatarUrl);
        onAvatarUploaded(result.avatarUrl);
      } else {
        setUploadError(result.error || 'Falha ao enviar foto.');
        setPreviewUrl(currentAvatarUrl || null);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Erro inesperado no upload.');
      setPreviewUrl(currentAvatarUrl || null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle, #1e293b)'
      }}
      data-testid="avatar-upload-container"
    >
      <div style={{ position: 'relative' }}>
        <Avatar
          src={previewUrl}
          name={userName}
          userType={userType}
          size="xl"
          alt={userName}
        />

        {/* Botão de Câmera / Gatilho de Upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          title="Alterar foto de perfil"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--neon-emerald, #00f59b)',
            border: '2px solid #06090e',
            color: '#06090e',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 10px rgba(0, 245, 155, 0.4)',
            transition: 'transform 0.15s ease'
          }}
          data-testid="btn-avatar-upload-trigger"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
        data-testid="input-avatar-file"
      />

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--neon-emerald, #00f59b)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
            padding: '4px 8px'
          }}
        >
          {isUploading ? 'Enviando imagem...' : 'Escolher foto de perfil'}
        </button>
        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
          JPG, PNG ou WebP até 5MB
        </span>
      </div>

      {uploadError && (
        <div
          style={{
            color: '#f87171',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '6px 12px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          data-testid="avatar-upload-error"
        >
          <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
