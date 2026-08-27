import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  title?: string;
  backLink?: {
    to: string;
    label: string;
  };
  children?: React.ReactNode;
}

export function Navbar({ title, backLink, children }: NavbarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const getUserEmail = (): string => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) return parsed.email;
      }
      const token = localStorage.getItem('token');
      if (token) {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded.email) return decoded.email;
        }
      }
    } catch {
      return 'Kullanıcı';
    }
    return 'Kullanıcı';
  };

  const email = getUserEmail();
  const initial = email.charAt(0).toUpperCase();

  const handleLogout = () => {
    if (logout) {
      logout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    navigate('/login');
  };

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {backLink && (
          <Link
            to={backLink.to}
            style={{
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            ← {backLink.label}
          </Link>
        )}
        {title && (
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            {title}
          </h1>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Sayfaya özel ek filtreler veya butonlar */}
        {children}

        {/* Aktif Kullanıcı Rozeti & Çıkış */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#f8fafc',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {initial}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{email}</span>
          <button
            onClick={handleLogout}
            style={{
              marginLeft: '6px',
              padding: '4px 8px',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Çıkış
          </button>
        </div>
      </div>
    </header>
  );
}