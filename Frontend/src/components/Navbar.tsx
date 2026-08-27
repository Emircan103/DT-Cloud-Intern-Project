import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.ts';

interface NavbarProps {
  title?: string;
  backLink?: {
    to: string;
    label: string;
  };
  children?: React.ReactNode;
}

export function Navbar({ title, backLink, children }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getEmail = (): string => {
    if (user?.email) return user.email;
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) return parsed.email;
      }
      const token = sessionStorage.getItem('token');
      if (token) {
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(atob(payload));
          if (decoded.email) return decoded.email;
        }
      }
    } catch {
      return 'Kullanıcı';
    }
    return 'Kullanıcı';
  };

  const email = getEmail();
  const initial = email.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {backLink && (
          <Link to={backLink.to} style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>← {backLink.label}</Link>
        )}
        {title && (
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{title}</h1>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {children}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
            {initial}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{email}</span>
          <button onClick={handleLogout} style={{ marginLeft: '4px', padding: '4px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Çıkış
          </button>
        </div>
      </div>
    </header>
  );
}