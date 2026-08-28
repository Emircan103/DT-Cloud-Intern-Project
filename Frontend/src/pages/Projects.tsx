import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuth } from '../context/useAuth';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  ownerId?: string;
}

export function Projects() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const getStoredUser = (): { id?: string; email?: string } => {
    if (user?.email) return user;
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) return JSON.parse(stored);
      const token = sessionStorage.getItem('token');
      if (token) {
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(atob(payload));
          return { id: decoded.userId, email: decoded.email };
        }
      }
    } catch {
      return {};
    }
    return {};
  };

  const currentUser = getStoredUser();
  const currentUserEmail = currentUser.email || 'Kullanıcı';
  const currentUserId = currentUser.id;

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await api.get('/projects');
        if (isMounted) {
          setProjects(res.data);
        }
      } catch (err) {
        console.error('Projeler alınamadı', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await api.post('/projects', { name: newTitle.trim(), description: newDesc.trim() });
      setProjects((prev) => [...prev, res.data]);
      setNewTitle('');
      setNewDesc('');
      setIsCreating(false);
    } catch (err) {
      console.error('Proje oluşturulamadı', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu projeyi kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Proje silinemedi', err);
      alert('Proje silinirken hata oluştu.');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      const res = await api.put(`/projects/${id}`, { 
        name: editTitle.trim(), 
        description: editDesc.trim() 
      });
      setProjects((prev) => prev.map((p) => (p.id === id ? res.data : p)));
      setEditingProjectId(null);
    } catch (err) {
      console.error('Proje güncellenemedi', err);
      alert('Proje güncellenirken hata oluştu.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Projeler yükleniyor...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Projelerim</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
            {currentUserEmail.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{currentUserEmail}</span>
          <button onClick={handleLogout} style={{ marginLeft: '6px', padding: '4px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Çıkış</button>
        </div>
      </header>

      <main style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#334155', margin: 0 }}>Tüm Projeler</h2>
          <button 
            onClick={() => setIsCreating(!isCreating)} 
            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
          >
            {isCreating ? 'İptal' : '+ Yeni Proje'}
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Proje Adı" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              required 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', backgroundColor: '#ffffff' }} 
            />
            <textarea 
              placeholder="Proje Açıklaması (Opsiyonel)" 
              value={newDesc} 
              onChange={(e) => setNewDesc(e.target.value)} 
              rows={3} 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', color: '#0f172a', backgroundColor: '#ffffff' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Oluştur</button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Henüz bir proje bulunmuyor.</div>
          ) : (
            projects.map(p => {
              const isOwner = p.ownerId === currentUserId;

              return (
                <div key={p.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                  
                  {editingProjectId === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <input 
                        type="text" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)} 
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', backgroundColor: '#ffffff', fontWeight: 700 }} 
                      />
                      <textarea 
                        value={editDesc} 
                        onChange={(e) => setEditDesc(e.target.value)} 
                        rows={2} 
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', backgroundColor: '#ffffff', resize: 'vertical' }} 
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                        <button onClick={() => setEditingProjectId(null)} style={{ padding: '6px 12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flex: 1 }}>İptal</button>
                        <button onClick={() => handleSaveEdit(p.id)} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flex: 1 }}>Kaydet</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* EKLENEN KISIM: PROJE ETİKETİ */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700, flex: 1, paddingRight: '8px' }}>{p.name}</h3>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          backgroundColor: isOwner ? '#eff6ff' : '#f8fafc', 
                          color: isOwner ? '#2563eb' : '#64748b', 
                          border: isOwner ? '1px solid #bfdbfe' : '1px solid #e2e8f0', 
                          fontWeight: 600, 
                          whiteSpace: 'nowrap' 
                        }}>
                          {isOwner ? '👑 Yönetici' : '👥 Katılımcı'}
                        </span>
                      </div>

                      {p.description && <p style={{ margin: 0, fontSize: '13px', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}
                      <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                        Oluşturulma: {new Date(p.createdAt).toLocaleDateString('tr-TR')}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <Link to={`/projects/${p.id}`} style={{ flex: 1 }}>
                          <button style={{ width: '100%', padding: '6px 0', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Projeye Git</button>
                        </Link>
                        
                        {isOwner && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingProjectId(p.id);
                                setEditTitle(p.name);
                                setEditDesc(p.description || '');
                              }} 
                              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id)} 
                              style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                              title="Sil"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}