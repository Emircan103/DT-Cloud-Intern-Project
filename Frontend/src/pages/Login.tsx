import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/useAuth';
import { api } from '../lib/axios';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Kilitlenme süresi için geri sayım sayacı
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isLocked && lockSeconds > 0) {
      timer = setInterval(() => {
        setLockSeconds((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError('');

    try {
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const token = res.data.token;
      const user = res.data.user || { email: email.trim() };

      login(token, user);
      navigate('/projects');
    } catch (err: unknown) {
      console.error(err);

      if (isAxiosError(err) && err.response) {
        const status = err.response.status;
        const responseData = err.response.data;

        if (status === 429) {
          setIsLocked(true);
          const seconds = responseData?.retryAfterSeconds || 60;
          setLockSeconds(seconds);
          setError(responseData?.error || 'Çok fazla hatalı giriş denemesi yaptınız.');
        } else {
          setError(responseData?.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
        }
      } else {
        setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      }
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', textAlign: 'center' }}>Giriş Yap</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0', textAlign: 'center' }}>Panonuza erişmek için giriş yapın</p>

        {error && (
          <div style={{
            backgroundColor: isLocked ? '#fee2e2' : '#fff7ed',
            color: isLocked ? '#991b1b' : '#c2410c',
            border: `1px solid ${isLocked ? '#fca5a5' : '#ffedd5'}`,
            padding: '12px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: '1.4'
          }}>
            <div>{isLocked ? '🚫 ' : '⚠️ '}{error}</div>
            {isLocked && lockSeconds > 0 && (
              <div style={{ marginTop: '6px', fontWeight: 700 }}>
                Kalan kilit süresi: {formatCountdown(lockSeconds)}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>E-posta</label>
            <input
              type="email"
              required
              disabled={isLocked}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@domain.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a', // Koyu yazı rengi
                boxSizing: 'border-box',
                backgroundColor: isLocked ? '#f1f5f9' : '#ffffff',
                cursor: isLocked ? 'not-allowed' : 'text',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Şifre</label>
            <input
              type="password"
              required
              disabled={isLocked}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a', // Koyu yazı rengi
                boxSizing: 'border-box',
                backgroundColor: isLocked ? '#f1f5f9' : '#ffffff',
                cursor: isLocked ? 'not-allowed' : 'text',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLocked}
            style={{
              backgroundColor: isLocked ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {isLocked ? 'Geçici Olarak Kilitlendi' : 'Giriş Yap'}
          </button>
        </form>

        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginTop: '20px', marginBottom: 0 }}>
          Hesabınız yok mu?{' '}
          <Link to="/register" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}