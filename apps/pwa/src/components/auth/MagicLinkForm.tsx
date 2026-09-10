import React, { useState } from 'react';
import { sendMagicLink, validateEmail } from '../../auth/auth-service.ts';
import { Button, Card } from '../ui/index.ts';
import { CheckCircle2 } from 'lucide-react';

interface MagicLinkFormProps {
  onSuccess?: (email: string) => void;
  redirectTo?: string;
}

export const MagicLinkForm: React.FC<MagicLinkFormProps> = ({
  onSuccess,
  redirectTo,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateEmail(email);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'E-mail inválido.');
      return;
    }

    setLoading(true);

    try {
      const response = await sendMagicLink(email, redirectTo);

      if (response.success) {
        setSuccessMessage(response.message);
        if (onSuccess) {
          onSuccess(email);
        }
      } else {
        setErrorMessage(response.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de comunicação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="delivrery-auth-card" style={{ maxWidth: '420px', margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neon-emerald)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Acesso Instantâneo
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
          Entrar sem senha
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', lineHeight: 1.4 }}>
          Informe seu e-mail para receber um link de acesso instantâneo. Seguro e sem senhas.
        </p>
      </div>

      {successMessage ? (
        <div
          style={{
            backgroundColor: 'rgba(0, 245, 155, 0.1)',
            border: '1px solid rgba(0, 245, 155, 0.3)',
            color: 'var(--neon-emerald)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}
          role="alert"
        >
          <div style={{ fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> Link enviado com sucesso!
          </div>
          <p style={{ margin: '8px 0 14px 0', fontSize: '13px', color: 'var(--text-primary)' }}>{successMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSuccessMessage(null);
              setEmail('');
            }}
          >
            Usar outro e-mail
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="delivrery-auth-email"
              style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Seu melhor e-mail
            </label>
            <input
              id="delivrery-auth-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="exemplo@seuemail.com.br"
              disabled={loading}
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '15px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--neon-emerald)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--alert-warning-dim)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fde68a',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            variant="cta"
            size="lg"
            fullWidth
            isLoading={loading}
          >
            Enviar Link de Acesso
          </Button>
        </form>
      )}
    </Card>
  );
};

export default MagicLinkForm;
