import React, { useState, useEffect } from 'react';
import { api } from '../lib/axios';

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: UserSummary;
}

interface ActivityLog {
  id: string;
  action: string;
  createdAt: string;
  user: UserSummary;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  assignee?: UserSummary | null;
}

interface Props {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  useEffect(() => {
    if (!task) return;

    const fetchData = async () => {
      try {
        const [commentsRes, activitiesRes] = await Promise.all([
          api.get(`/tasks/${task.id}/comments`),
          api.get(`/tasks/${task.id}/activity`),
        ]);
        setComments(commentsRes.data);
        setActivities(activitiesRes.data);
      } catch (err) {
        console.error('Veriler yüklenirken hata oluştu', err);
      }
    };

    fetchData();
  }, [task]);

  if (!task) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, {
        content: newComment.trim(),
      });
      // Kendi yorumumuzu doğrudan ekleyelim (Socket diğer kullanıcılara ulaştıracak)
      setComments((prev) => [...prev, res.data]);
      setNewComment('');
    } catch (err) {
      console.error('Yorum eklenemedi', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'TASK_CREATED':
        return 'görevi oluşturdu';
      case 'TASK_MOVED':
        return 'görevin durumunu/kolonunu değiştirdi';
      case 'TASK_ASSIGNED':
        return 'görevi bir kullanıcıya atadı';
      case 'TASK_UPDATED':
        return 'görev detaylarını güncelledi';
      case 'TASK_DELETED':
        return 'görevi sildi';
      case 'COMMENT_ADDED':
        return 'bir yorum ekledi';
      default:
        return action;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{task.title}</h3>
            {task.assignee && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>Atanan: {task.assignee.name || task.assignee.email}</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Açıklama</span>
          <p style={{ margin: 0, fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
            {task.description || 'Açıklama girilmemiş.'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px' }}>
          <button
            onClick={() => setActiveTab('comments')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'comments' ? 600 : 500,
              color: activeTab === 'comments' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'comments' ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            Yorumlar ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'activity' ? 600 : 500,
              color: activeTab === 'activity' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'activity' ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            Aktivite Geçmişi ({activities.length})
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeTab === 'comments' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '120px' }}>
                {comments.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Henüz yorum yapılmamış.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{c.author?.name || c.author?.email}</strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input
                  type="text"
                  placeholder="Yorum ekleyin..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Gönder
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activities.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kayıtlı aktivite bulunmuyor.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
                    <strong style={{ color: '#0f172a' }}>{act.user?.name || act.user?.email}</strong>
                    <span>{getActionLabel(act.action)}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>
                      {new Date(act.createdAt).toLocaleDateString()} {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}