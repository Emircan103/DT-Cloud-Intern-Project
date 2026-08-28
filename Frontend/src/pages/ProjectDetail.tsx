import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../context/useAuth';
import { socket, connectSocketWithToken } from '../lib/socket';

interface Board {
  id: string;
  name: string;
  createdAt: string;
  _count?: { columns: number };
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  boards: Board[];
}

export function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Yeni Pano Ekleme
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  // Pano Düzenleme
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState('');

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
  const currentUserId = currentUser.id;
  const currentUserEmail = currentUser.email || 'Kullanıcı';

  const loadProject = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!projectId) return;
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data);
      } catch (err: unknown) {
        console.error('Proje detayları alınamadı', err);
        if (err instanceof AxiosError) {
          if (err.response?.status === 404 || err.response?.status === 403) {
            navigate('/projects', { replace: true });
          }
        }
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [projectId, navigate]
  );

  // İlk veri yüklemesi ayrı bir effect içinde asenkron tetikleyici olarak yönetiliyor (Cascading render uyarısını önler)
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      if (!projectId) return;
      try {
        const res = await api.get(`/projects/${projectId}`);
        if (isMounted) {
          setProject(res.data);
        }
      } catch (err: unknown) {
        console.error('Proje detayları alınamadı', err);
        if (err instanceof AxiosError) {
          if (err.response?.status === 404 || err.response?.status === 403) {
            navigate('/projects', { replace: true });
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, [projectId, navigate]);

  // Anlık güncellemeler: proje silindiğinde, projedeki erişim (görev bazlı) sona erdiğinde
  // veya panolar/görevler değiştiğinde bu sayfayı canlı tutuyoruz.
  useEffect(() => {
    if (!projectId) return;

    connectSocketWithToken();

    const handleAccessRevokedOrDeleted = (data?: { projectId?: string }) => {
      if (!data?.projectId || data.projectId === projectId) {
        setEditingBoardId(null);
        setIsCreatingBoard(false);
        setProject(null);
        setLoading(true);
        navigate('/projects', { replace: true });
      }
    };

    const handleProjectRefresh = () => {
      loadProject({ silent: true });
    };

    socket.on('access:revoked', handleAccessRevokedOrDeleted);
    socket.on('project:deleted', handleAccessRevokedOrDeleted);
    socket.on('project:updated', handleProjectRefresh);

    return () => {
      socket.off('access:revoked', handleAccessRevokedOrDeleted);
      socket.off('project:deleted', handleAccessRevokedOrDeleted);
      socket.off('project:updated', handleProjectRefresh);
    };
  }, [projectId, navigate, loadProject]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    try {
      const res = await api.post(`/projects/${projectId}/boards`, { name: newBoardName.trim() });
      setProject((prev) => prev ? { ...prev, boards: [res.data, ...prev.boards] } : prev);
      setNewBoardName('');
      setIsCreatingBoard(false);
    } catch (err) {
      console.error('Pano oluşturulamadı', err);
      alert('Pano oluşturulurken hata oluştu.');
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm('Bu panoyu ve içindeki tüm görevleri kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/boards/${boardId}`);
      setProject((prev) => prev ? { ...prev, boards: prev.boards.filter(b => b.id !== boardId) } : prev);
    } catch (err) {
      console.error('Pano silinemedi', err);
      alert('Pano silinirken hata oluştu.');
    }
  };

  const handleSaveEditBoard = async (boardId: string) => {
    if (!editBoardName.trim()) return;
    try {
      const res = await api.patch(`/boards/${boardId}`, { name: editBoardName.trim() });
      setProject((prev) => prev ? { 
        ...prev, 
        boards: prev.boards.map(b => b.id === boardId ? { ...b, name: res.data.name } : b) 
      } : prev);
      setEditingBoardId(null);
    } catch (err) {
      console.error('Pano güncellenemedi', err);
      alert('Pano güncellenirken hata oluştu.');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Proje detayları yükleniyor...</div>;
  }

  if (!project) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Proje bulunamadı.</div>;
  }

  const isOwner = currentUserId === project.ownerId;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/projects" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>← Projelere Dön</Link>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{project.name}</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
            {currentUserEmail.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{currentUserEmail}</span>
          <button onClick={handleLogout} style={{ marginLeft: '6px', padding: '4px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Çıkış</button>
        </div>
      </header>

      <main style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        {project.description && (
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Proje Açıklaması</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>{project.description}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#334155', margin: 0 }}>Panolar</h2>
          {isOwner && (
            <button 
              onClick={() => setIsCreatingBoard(!isCreatingBoard)} 
              style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              {isCreatingBoard ? 'İptal' : '+ Yeni Pano'}
            </button>
          )}
        </div>

        {isCreatingBoard && isOwner && (
          <form onSubmit={handleCreateBoard} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Pano Adı" 
              value={newBoardName} 
              onChange={(e) => setNewBoardName(e.target.value)} 
              required 
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', backgroundColor: '#ffffff' }} 
            />
            <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Oluştur</button>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {project.boards.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Bu projeye ait henüz bir pano bulunmuyor.</div>
          ) : (
            project.boards.map(board => {
              return (
                <div key={board.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                  
                  {editingBoardId === board.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <input 
                        type="text" 
                        value={editBoardName} 
                        onChange={(e) => setEditBoardName(e.target.value)} 
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', backgroundColor: '#ffffff', fontWeight: 700 }} 
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                        <button onClick={() => setEditingBoardId(null)} style={{ padding: '6px 12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flex: 1 }}>İptal</button>
                        <button onClick={() => handleSaveEditBoard(board.id)} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flex: 1 }}>Kaydet</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>{board.name}</h3>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        Kolon Sayısı: <strong>{board._count?.columns || 0}</strong>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                        Oluşturulma: {new Date(board.createdAt).toLocaleDateString('tr-TR')}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <Link to={`/boards/${board.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                          <button style={{ width: '100%', padding: '6px 0', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Panoya Git</button>
                        </Link>
                        
                        {isOwner && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingBoardId(board.id);
                                setEditBoardName(board.name);
                              }} 
                              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDeleteBoard(board.id)} 
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