import React, { useState } from 'react';
import { sendMagicLink, validateEmail } from '../../auth/auth-service.ts';

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
    const startTime = performance.now();

    try {
      const response = await sendMagicLink(email, redirectTo);
      const elapsed = performance.now() - startTime;

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
    <div className="delivrery-auth-card" style={containerStyle}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
          Acesso Passwordless
        </h2>
        <p style={{ color: '#4b5563', fontSize: '14px', marginTop: '8px' }}>
          Informe seu e-mail para receber um link de acesso instantâneo. Sem senhas.
        </p>
      </div>

      {successMessage ? (
        <div style={successBoxStyle} role="alert">
          <div style={{ fontWeight: 600, fontSize: '15px' }}>✓ Link enviado!</div>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>{successMessage}</p>
          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setEmail('');
            }}
            style={secondaryButtonStyle}
          >
            Usar outro e-mail
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="delivrery-auth-email"
              style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
            >
              Endereço de E-mail
            </label>
            <input
              id="delivrery-auth-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="exemplo@delivrery.com.br"
              disabled={loading}
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>

          {errorMessage && (
            <div style={errorBoxStyle} role="alert">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...primaryButtonStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Disparando Magic Link...' : 'Enviar Link de Acesso'}
          </button>
        </form>
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  maxWidth: '420px',
  width: '100%',
  margin: '0 auto',
  padding: '32px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
  border: '1px solid #e5e7eb',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '15px',
  border: '1.5px solid #d1d5db',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  fontSize: '15px',
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#10b981',
  border: 'none',
  borderRadius: '8px',
  transition: 'background-color 0.2s',
};

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: '12px',
  background: 'transparent',
  border: 'none',
  color: '#065f46',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
};

const successBoxStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  color: '#065f46',
  padding: '16px',
  borderRadius: '8px',
  textAlign: 'center',
};

const errorBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  padding: '10px 14px',
  borderRadius: '8px',
  fontSize: '13px',
  marginBottom: '16px',
};

export default MagicLinkForm;
