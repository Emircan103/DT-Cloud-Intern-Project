import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { api } from '../lib/axios';

interface UserSummary {
  id: string;
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
  assigneeId?: string | null;
  columnId?: string;
}

interface Props {
  task: Task | null;
  onClose: () => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

export function TaskDetailModal({ task, onClose, onTaskUpdated, onTaskDeleted }: Props) {
  if (!task) return null;

  return (
    <TaskDetailModalContent
      key={task.id}
      task={task}
      onClose={onClose}
      onTaskUpdated={onTaskUpdated}
      onTaskDeleted={onTaskDeleted}
    />
  );
}

function TaskDetailModalContent({ task, onClose, onTaskUpdated, onTaskDeleted }: {
  task: Task;
  onClose: () => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editAssigneeId, setEditAssigneeId] = useState(task.assignee?.id || task.assigneeId || '');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.get(`/tasks/${task.id}/comments`),
      api.get(`/tasks/${task.id}/activity`),
      api.get('/auth/users'),
    ])
      .then(([commentsRes, activitiesRes, usersRes]) => {
        if (!isMounted) return;
        setComments(commentsRes.data);
        setActivities(activitiesRes.data);
        setUsers(usersRes.data);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.error('Veriler yüklenirken hata oluştu', err);
      });

    return () => {
      isMounted = false;
    };
  }, [task.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, {
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, res.data]);
      setNewComment('');

      const actRes = await api.get(`/tasks/${task.id}/activity`);
      setActivities(actRes.data);
    } catch (err: unknown) {
      console.error('Yorum eklenemedi', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      const res = await api.put(`/tasks/${task.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        assigneeId: editAssigneeId ? editAssigneeId : null,
      });
      if (onTaskUpdated) onTaskUpdated(res.data);
      setIsEditing(false);

      const actRes = await api.get(`/tasks/${task.id}/activity`);
      setActivities(actRes.data);
    } catch (err: unknown) {
      console.error('Görev güncellenemedi', err);
      let message = 'Görev güncellenirken hata oluştu.';
      if (err instanceof AxiosError && err.response?.data?.error) {
        message = err.response.data.error;
      }
      alert(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;

    try {
      await api.delete(`/tasks/${task.id}`);
      if (onTaskDeleted) onTaskDeleted(task.id);
      onClose();
    } catch (err: unknown) {
      console.error('Görev silinemedi', err);
      alert('Görev silinirken hata oluştu.');
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'TASK_CREATED': return 'görevi oluşturdu';
      case 'TASK_MOVED': return 'görevin kolonunu değiştirdi';
      case 'TASK_ASSIGNED': return 'görevi atadı';
      case 'TASK_UPDATED': return 'görev detaylarını güncelledi';
      case 'TASK_DELETED': return 'görevi sildi';
      case 'COMMENT_ADDED': return 'bir yorum ekledi';
      default: return action;
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
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                backgroundColor: isEditing ? '#e2e8f0' : '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              {isEditing ? 'Düzenlemeyi Kapat' : '✏️ Düzenle'}
            </button>
            <button
              onClick={handleDeleteTask}
              style={{
                backgroundColor: '#fee2e2',
                color: '#ef4444',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🗑️ Sil
            </button>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 24px', backgroundColor: isEditing ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Başlık
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Görev başlığı"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Açıklama
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Açıklama"
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Kullanıcı Ata (Assignee)
                </label>
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="">-- Atanmamış --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '6px 12px', border: 'none', background: '#e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                  style={{ padding: '6px 14px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  {savingEdit ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{task.title}</h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                Atanan:{' '}
                {task.assignee ? (
                  <strong style={{ color: '#2563eb' }}>{task.assignee.email}</strong>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Kimseye atanmamış</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {task.description || 'Açıklama girilmemiş.'}
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', backgroundColor: '#ffffff' }}>
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
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{c.author?.email}</strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
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
                    <strong style={{ color: '#0f172a' }}>{act.user?.email}</strong>
                    <span>{getActionLabel(act.action)}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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