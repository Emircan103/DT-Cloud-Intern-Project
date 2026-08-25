import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { socket } from '../lib/socket';
import { TaskDetailModal } from '../components/TaskDetailModal';

interface UserSummary {
  id: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  columnId: string;
  assignee?: UserSummary | null;
  assigneeId?: string | null;
}

interface Column {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
}

interface BoardData {
  id: string;
  name: string;
  projectId: string;
  columns: Column[];
}

export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserSummary[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Arama & Assignee Filtresi
  const [search, setSearch] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');

  // Pano Başlığı Düzenleme
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState('');

  // Hızlı Görev Ekleme Formu
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Veri yükleme fonksiyonu
  const loadData = () => {
    if (!boardId) return;
    api.get(`/boards/${boardId}/columns`, {
      params: {
        search: search || undefined,
        assigneeId: filterAssigneeId || undefined,
      },
    })
      .then((res) => {
        setBoard({
          ...res.data.board,
          columns: res.data.columns.map((col: Column) => ({
            ...col,
            tasks: (col.tasks || []).sort((a: Task, b: Task) => a.order - b.order),
          })),
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Pano yüklenemedi', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    if (!boardId) return;

    api.get(`/boards/${boardId}/columns`, {
      params: {
        search: search || undefined,
        assigneeId: filterAssigneeId || undefined,
      },
    })
      .then((res) => {
        if (!isMounted) return;
        setBoard({
          ...res.data.board,
          columns: res.data.columns.map((col: Column) => ({
            ...col,
            tasks: (col.tasks || []).sort((a: Task, b: Task) => a.order - b.order),
          })),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Pano yüklenemedi', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [boardId, search, filterAssigneeId]);

  // Socket & Presence Bağlantısı
  useEffect(() => {
    if (!boardId) return;

    api.get('/auth/users').then((res) => setAllUsers(res.data)).catch(() => {});

    socket.connect();
    socket.emit('join:board', boardId);

    const handlePresenceUpdate = (users: UserSummary[]) => {
      const uniqueUsers = Array.from(new Map(users.map((u) => [u.id, u])).values());
      setActiveUsers(uniqueUsers);
    };

    const handleTaskEvents = () => {
      loadData();
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('task:created', handleTaskEvents);
    socket.on('task:updated', handleTaskEvents);
    socket.on('task:deleted', handleTaskEvents);

    return () => {
      socket.emit('leave:board', boardId);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('task:created', handleTaskEvents);
      socket.off('task:updated', handleTaskEvents);
      socket.off('task:deleted', handleTaskEvents);
      socket.disconnect();
    };
  }, [boardId]);

  // Pano Adı Güncelleme
  const handleUpdateBoardName = async () => {
    if (!boardNameInput.trim() || !board) return;
    try {
      const res = await api.patch(`/boards/${board.id}`, { name: boardNameInput.trim() });
      setBoard((prev) => (prev ? { ...prev, name: res.data.name } : null));
      setIsEditingBoardName(false);
    } catch (err) {
      console.error('Pano adı güncellenemedi:', err);
      alert('Pano adı güncellenirken bir hata oluştu.');
    }
  };

  // Yeni Görev Ekleme
  const handleSaveTask = async (columnId: string) => {
    if (!newTitle.trim() || submittingTask) return;

    setSubmittingTask(true);
    try {
      await api.post(`/columns/${columnId}/tasks`, {
        title: newTitle.trim(),
        description: newDescription.trim(),
        assigneeId: newAssigneeId ? newAssigneeId : null,
      });

      setNewTitle('');
      setNewDescription('');
      setNewAssigneeId('');
      setAddingColumnId(null);
      loadData();
    } catch (err) {
      console.error('Görev eklenemedi', err);
      alert('Görev eklenirken hata oluştu.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Drag & Drop Fonksiyonları
  const handleDragStart = (e: React.DragEvent, taskId: string, sourceColumnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId, sourceColumnId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnColumn = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const { taskId } = JSON.parse(data);
    const targetColumn = board?.columns.find((c) => c.id === targetColumnId);
    const newOrder = targetColumn ? targetColumn.tasks.length : 0;

    await executeMove(taskId, targetColumnId, newOrder);
  };

  const handleDropOnTask = async (e: React.DragEvent, targetTaskId: string, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const { taskId } = JSON.parse(data);
    if (taskId === targetTaskId) return;

    const targetColumn = board?.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    const targetIndex = targetColumn.tasks.findIndex((t) => t.id === targetTaskId);
    const newOrder = targetIndex !== -1 ? targetIndex : 0;

    await executeMove(taskId, targetColumnId, newOrder);
  };

  const executeMove = async (taskId: string, targetColumnId: string, newOrder: number) => {
    // İyimser UI Güncellemesi
    setBoard((prev) => {
      if (!prev) return prev;
      let movingTask: Task | undefined;

      const updatedCols = prev.columns.map((col) => {
        const remaining = col.tasks.filter((t) => {
          if (t.id === taskId) {
            movingTask = { ...t, columnId: targetColumnId };
            return false;
          }
          return true;
        });
        return { ...col, tasks: remaining };
      });

      if (!movingTask) return prev;

      return {
        ...prev,
        columns: updatedCols.map((col) => {
          if (col.id === targetColumnId) {
            const list = [...col.tasks];
            list.splice(newOrder, 0, movingTask!);
            return {
              ...col,
              tasks: list.map((t, idx) => ({ ...t, order: idx })),
            };
          }
          return {
            ...col,
            tasks: col.tasks.map((t, idx) => ({ ...t, order: idx })),
          };
        }),
      };
    });

    try {
      await api.put(`/tasks/${taskId}/move`, { targetColumnId, newOrder });
    } catch (err) {
      console.error('Taşıma hatası', err);
      loadData();
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Pano yükleniyor...</div>;
  }

  if (!board) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Pano bulunamadı.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={`/projects/${board.projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px' }}>
            ← Projeye Dön
          </Link>

          {isEditingBoardName ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={boardNameInput}
                onChange={(e) => setBoardNameInput(e.target.value)}
                autoFocus
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: 700 }}
              />
              <button
                onClick={handleUpdateBoardName}
                style={{ padding: '4px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                Kaydet
              </button>
              <button
                onClick={() => setIsEditingBoardName(false)}
                style={{ padding: '4px 8px', backgroundColor: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                İptal
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{board.name}</h1>
              <button
                onClick={() => {
                  setBoardNameInput(board.name);
                  setIsEditingBoardName(true);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748b' }}
                title="Pano Adını Düzenle"
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Başlık veya açıklamada ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '220px' }}
          />

          <select
            value={filterAssigneeId}
            onChange={(e) => setFilterAssigneeId(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
          >
            <option value="">Tüm Kişiler</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Presence Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Panodakiler:</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {activeUsers.map((u) => (
              <div
                key={u.id}
                title={u.email}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: '0 0 0 2px #fff',
                }}
              >
                {u.email.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Columns List */}
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {board.columns.map((column) => (
          <div
            key={column.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnColumn(e, column.id)}
            style={{
              backgroundColor: '#e2e8f0',
              borderRadius: '8px',
              width: '320px',
              minWidth: '320px',
              maxHeight: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#334155' }}>
                {column.name} ({column.tasks.length})
              </span>
              <button
                onClick={() => {
                  setAddingColumnId(column.id);
                  setNewTitle('');
                  setNewDescription('');
                  setNewAssigneeId('');
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + Ekle
              </button>
            </div>

            {/* Quick Add Form */}
            {addingColumnId === column.id && (
              <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #cbd5e1' }}>
                <input
                  type="text"
                  placeholder="Görev Başlığı..."
                  value={newTitle}
                  autoFocus
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                />
                <textarea
                  placeholder="Açıklama (Opsiyonel)..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box', resize: 'none' }}
                />
                <select
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="">-- Kişi Ata (Opsiyonel) --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setAddingColumnId(null)}
                    style={{ padding: '6px 12px', border: 'none', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    İptal
                  </button>
                  <button
                    onClick={() => handleSaveTask(column.id)}
                    disabled={submittingTask || !newTitle.trim()}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '4px',
                      cursor: submittingTask || !newTitle.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {submittingTask ? 'Ekleniyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            )}

            {/* Task Cards */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnTask(e, task.id, column.id)}
                  onClick={() => setSelectedTask(task)}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '12px',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    cursor: 'grab',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
                      {task.description}
                    </div>
                  )}
                  {task.assignee && (
                    <span style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                      👤 {task.assignee.email}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* Task Modal */}
      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => loadData()}
        onTaskDeleted={() => {
          setSelectedTask(null);
          loadData();
        }}
      />
    </div>
  );
}