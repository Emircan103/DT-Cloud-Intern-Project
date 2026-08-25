import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { socket } from '../lib/socket';
import { TaskDetailModal } from '../components/TaskDetailModal';

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  columnId: string;
  assignee?: UserSummary | null;
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBoardData = useCallback(async () => {
    if (!boardId) return;
    try {
      const res = await api.get(`/boards/${boardId}`);
      const sortedBoard = {
        ...res.data,
        columns: res.data.columns.map((col: Column) => ({
          ...col,
          tasks: (col.tasks || []).sort((a: Task, b: Task) => a.order - b.order),
        })),
      };
      setBoard(sortedBoard);
    } catch (err) {
      console.error('Board yüklenemedi', err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    let isMounted = true;

    api.get(`/boards/${boardId}`)
      .then((res) => {
        if (!isMounted) return;
        const sortedBoard = {
          ...res.data,
          columns: res.data.columns.map((col: Column) => ({
            ...col,
            tasks: (col.tasks || []).sort((a: Task, b: Task) => a.order - b.order),
          })),
        };
        setBoard(sortedBoard);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Board yüklenemedi', err);
        setLoading(false);
      });

    socket.connect();
    socket.emit('join:board', boardId);

    const handlePresenceUpdate = (users: UserSummary[]) => {
      const uniqueUsers = Array.from(new Map(users.map((u) => [u.id, u])).values());
      setActiveUsers(uniqueUsers);
    };

    const handleTaskCreated = (newTask: Task) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === newTask.columnId) {
              const exists = col.tasks.some((t) => t.id === newTask.id);
              if (exists) return col;
              return { ...col, tasks: [...col.tasks, newTask].sort((a, b) => a.order - b.order) };
            }
            return col;
          }),
        };
      });
    };

    const handleTaskUpdated = (updatedTask: Task) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            const otherTasks = col.tasks.filter((t) => t.id !== updatedTask.id);
            if (col.id === updatedTask.columnId) {
              return { ...col, tasks: [...otherTasks, updatedTask].sort((a, b) => a.order - b.order) };
            }
            return { ...col, tasks: otherTasks };
          }),
        };
      });
    };

    const handleTaskDeleted = ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === columnId) {
              return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
            }
            return col;
          }),
        };
      });
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      isMounted = false;
      socket.emit('leave:board', boardId);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.disconnect();
    };
  }, [boardId]);

  const handleQuickAddTask = async (columnId: string) => {
    const title = window.prompt('Görev başlığı:');
    if (!title?.trim()) return;

    try {
      const res = await api.post('/tasks', { title: title.trim(), columnId });
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, tasks: [...col.tasks, res.data] } : col
          ),
        };
      });
    } catch (err) {
      console.error('Görev eklenemedi', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, sourceColumnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId, sourceColumnId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const { taskId, sourceColumnId } = JSON.parse(data);
    if (sourceColumnId === targetColumnId) return;

    setBoard((prev) => {
      if (!prev) return prev;
      let movedTask: Task | undefined;
      const newColumns = prev.columns.map((col) => {
        if (col.id === sourceColumnId) {
          movedTask = col.tasks.find((t) => t.id === taskId);
          return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        }
        return col;
      });

      if (!movedTask) return prev;
      movedTask.columnId = targetColumnId;

      return {
        ...prev,
        columns: newColumns.map((col) =>
          col.id === targetColumnId ? { ...col, tasks: [...col.tasks, movedTask!] } : col
        ),
      };
    });

    try {
      await api.patch(`/tasks/${taskId}`, { columnId: targetColumnId });
    } catch (err) {
      console.error('Görev taşınamadı', err);
      loadBoardData();
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
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={`/projects/${board.projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px' }}>
            ← Projeye Dön
          </Link>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{board.name}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Şu an panoda:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {activeUsers.map((u) => (
              <div
                key={u.id}
                title={u.name || u.email}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 0 0 2px #fff',
                }}
              >
                {(u.name || u.email).charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px', overflowX: 'auto', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {board.columns.map((column) => (
          <div
            key={column.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            style={{
              backgroundColor: '#e2e8f0',
              borderRadius: '8px',
              width: '300px',
              minWidth: '300px',
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
                onClick={() => handleQuickAddTask(column.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 700,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
                title="Yeni Görev Ekle"
              >
                +
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id, column.id)}
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
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}