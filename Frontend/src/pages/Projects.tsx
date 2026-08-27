import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: {
    boards: number;
  };
}

export function Projects() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  // Düzenleme State'leri
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Kullanıcının tam e-posta adresini (kullanıcıadı@gmail.com) alan fonksiyon
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
          const decodedJson = JSON.parse(atob(payloadBase64));
          if (decodedJson.email) return decodedJson.email;
        }
      }
    } catch {
      return 'Kullanıcı';
    }
    return 'Kullanıcı';
  };

  const userEmail = getUserEmail();
  const initialLetter = userEmail.charAt(0).toUpperCase();

  const loadProjects = () => {
    api.get('/projects')
      .then((res) => {
        setProjects(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Projeler yüklenemedi', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      loadProjects();
    } catch (err) {
      console.error('Proje oluşturulamadı', err);
      alert('Proje oluşturulurken bir hata oluştu.');
    }
  };

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProjectId(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;

    try {
      await api.patch(`/projects/${projectId}`, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingProjectId(null);
      loadProjects();
    } catch (err) {
      console.error('Proje güncellenemedi', err);
      alert('Proje güncellenirken hata oluştu.');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Bu projeyi ve altındaki tüm panoları silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await api.delete(`/projects/${projectId}`);
      loadProjects();
    } catch (err) {
      console.error('Proje silinemedi', err);
      alert('Proje silinirken hata oluştu.');
    }
  };

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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '32px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Projeler</h1>
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>Tüm projelerinizi ve panolarınızı buradan yönetin</p>
          </div>

          {/* Aktif Kullanıcı Göstergesi & Çıkış */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
              {initialLetter}
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{userEmail}</span>
            <button
              onClick={handleLogout}
              style={{ marginLeft: '6px', padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Çıkış
            </button>
          </div>
        </header>

        {/* Yeni Proje Formu */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>+ Yeni Proje Oluştur</h2>
          <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Proje Adı *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
            <input
              type="text"
              placeholder="Açıklama (Opsiyonel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ flex: 2, minWidth: '250px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
            <button
              type="submit"
              style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Oluştur
            </button>
          </form>
        </div>

        {/* Projeler Listesi */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Yükleniyor...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            Henüz oluşturulmuş bir proje yok.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {projects.map((project) => (
              <div
                key={project.id}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '140px',
                }}
              >
                {editingProjectId === project.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      placeholder="Açıklama"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={handleCancelEdit}
                        style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#475569' }}
                      >
                        İptal
                      </button>
                      <button
                        onClick={(e) => handleSaveEdit(e, project.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <Link
                          to={`/projects/${project.id}`}
                          style={{ textDecoration: 'none', color: '#0f172a', fontSize: '17px', fontWeight: 700 }}
                        >
                          {project.name}
                        </Link>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={(e) => handleStartEdit(e, project)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444' }}
                            title="Sil"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {project.description && (
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {project._count?.boards || 0} Pano
                      </span>
                      <Link
                        to={`/projects/${project.id}`}
                        style={{ textDecoration: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600 }}
                      >
                        Panoları Aç →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}