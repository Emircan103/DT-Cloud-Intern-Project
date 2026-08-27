import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Navbar } from '../components/Navbar';

interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  _count?: {
    columns: number;
  };
}

interface ProjectData {
  id: string;
  name: string;
  description?: string | null;
  boards: BoardSummary[];
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProject = () => {
    if (!id) return;
    api.get(`/projects/${id}`)
      .then((res) => {
        setProject(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Proje yüklenemedi', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim() || !id) return;

    try {
      await api.post(`/projects/${id}/boards`, { name: boardName.trim() });
      setBoardName('');
      loadProject();
    } catch (err) {
      console.error('Pano oluşturulamadı', err);
      alert('Pano oluşturulurken hata oluştu.');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;
  }

  if (!project) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Proje bulunamadı.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar title={project.name} backLink={{ to: '/projects', label: 'Projeler' }} />

      <main style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {project.description && (
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: 0, marginBottom: '24px' }}>
            {project.description}
          </p>
        )}

        {/* Yeni Pano Oluştur */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>+ Yeni Pano Ekle</h2>
          <form onSubmit={handleCreateBoard} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="Pano Adı (Örn: Kanban, Sprint 1) *"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              required
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
            <button
              type="submit"
              style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Pano Oluştur
            </button>
          </form>
        </div>

        {/* Panolar Listesi */}
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Panolar</h2>
        {project.boards.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            Bu projeye ait henüz bir pano bulunmuyor.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {project.boards.map((b) => (
              <Link
                key={b.id}
                to={`/boards/${b.id}`}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{b.name}</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{b._count?.columns || 0} Kolon</span>
                </div>
                <div style={{ marginTop: '16px', fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                  Panoya Git →
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}