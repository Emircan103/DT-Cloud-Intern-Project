import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Input,
  Heading,
  Text,
  Flex,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { api } from '../lib/axios';
import { TaskCard, type TaskItem, type TaskUser } from '../components/TaskCard';

interface ColumnItem {
  id: string;
  name: string;
  order: number;
  tasks: TaskItem[];
}

export const Board = () => {
  const { id } = useParams<{ id: string }>(); // Board ID
  const navigate = useNavigate();

  const [columns, setColumns] = useState<ColumnItem[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [error, setError] = useState('');

  // Yeni görev ekleme form state'i
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Kullanıcıları getir
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users');
        setUsers(res.data);
      } catch (err) {
        console.error('Kullanıcılar yüklenemedi:', err);
      }
    };
    fetchUsers();
  }, []);

  const refreshData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/boards/${id}/columns`, {
        params: {
          search: search || undefined,
          assigneeId: selectedAssignee || undefined,
        },
      });
      setColumns(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Kolonlar ve görevler yüklenemedi.');
      }
    }
  }, [id, search, selectedAssignee]);

  useEffect(() => {
    let ignore = false;

    const loadColumns = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/boards/${id}/columns`, {
          params: {
            search: search || undefined,
            assigneeId: selectedAssignee || undefined,
          },
        });
        if (!ignore) {
          setColumns(res.data);
        }
      } catch (err: unknown) {
        if (!ignore && axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Kolonlar ve görevler yüklenemedi.');
        }
      }
    };

    loadColumns();

    return () => {
      ignore = true;
    };
  }, [id, search, selectedAssignee]);

  // Yeni görev oluşturma
  const handleCreateTask = async (columnId: string) => {
    if (!taskTitle.trim()) return;

    try {
      await api.post(`/columns/${columnId}/tasks`, {
        title: taskTitle,
        description: taskDescription,
        assigneeId: taskAssigneeId || undefined,
      });

      setTaskTitle('');
      setTaskDescription('');
      setTaskAssigneeId('');
      setActiveColumnId(null);
      await refreshData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Görev oluşturulamadı.');
      }
    }
  };

  // Görev güncelleme
  const handleUpdateTask = async (
    taskId: string,
    updatedData: { title: string; description?: string; assigneeId?: string | null }
  ) => {
    try {
      await api.put(`/tasks/${taskId}`, updatedData);
      await refreshData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Görev güncellenemedi.');
      }
    }
  };

  // Görev silme
  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      await refreshData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Görev silinemedi.');
      }
    }
  };

  // Sürükle ve Bırak Olayı
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);

    let sourceColumn: ColumnItem | undefined;
    let draggedTask: TaskItem | undefined;

    for (const col of columns) {
      const task = col.tasks.find((t) => t.id === activeTaskId);
      if (task) {
        sourceColumn = col;
        draggedTask = task;
        break;
      }
    }

    if (!draggedTask || !sourceColumn) return;

    let destinationColumn = columns.find((c) => c.id === overId);
    if (!destinationColumn) {
      destinationColumn = columns.find((c) =>
        c.tasks.some((t) => t.id === overId)
      );
    }

    if (!destinationColumn) return;

    // Optimistic UI güncellemesi
    const updatedColumns = columns.map((col) => {
      if (col.id === sourceColumn?.id && col.id === destinationColumn?.id) {
        return col;
      }
      if (col.id === sourceColumn?.id) {
        return { ...col, tasks: col.tasks.filter((t) => t.id !== activeTaskId) };
      }
      if (col.id === destinationColumn?.id) {
        return {
          ...col,
          tasks: [...col.tasks, { ...draggedTask!, columnId: destinationColumn.id }],
        };
      }
      return col;
    });

    setColumns(updatedColumns);

    try {
      await api.put(`/tasks/${activeTaskId}/move`, {
        destinationColumnId: destinationColumn.id,
        newOrder: destinationColumn.tasks.length,
      });
    } catch (err: unknown) {
      console.error('Taşıma hatası:', err);
      await refreshData();
    }
  };

  return (
    <Box maxW="7xl" mx="auto" mt={6} p={4}>
      {/* Üst Başlık & Arama / Filtreleme Çubuğu */}
      <Flex justifyContent="space-between" alignItems="center" mb={6} flexWrap="wrap" gap={4}>
        <HStack>
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            ← Geri Dön
          </Button>
          <Heading size="lg">Kanban Panosu</Heading>
        </HStack>

        <HStack spaceX={3}>
          <Input
            placeholder="Görevlerde ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="sm"
            maxW="200px"
          />

          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              background: 'white',
            }}
          >
            <option value="">Tüm Kişiler</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </HStack>
      </Flex>

      {error && (
        <Box p={3} bg="red.100" color="red.700" borderRadius="md" mb={4}>
          <Text fontWeight="bold">{error}</Text>
        </Box>
      )}

      {/* Sürükle Bırak Kanban Alanı */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <Flex gap={6} overflowX="auto" pb={6} align="flex-start">
          {columns.map((column) => (
            <Box
              key={column.id}
              minW="320px"
              maxW="320px"
              bg="gray.100"
              p={4}
              borderRadius="lg"
              boxShadow="sm"
            >
              {/* Kolon Başlığı */}
              <Flex justifyContent="space-between" alignItems="center" mb={4}>
                <Heading size="sm" color="gray.700">
                  {column.name} ({column.tasks.length})
                </Heading>
              </Flex>

              {/* Kolondaki Görevler */}
              <SortableContext
                items={column.tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <Box minH="50px">
                  {column.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      users={users}
                      onDelete={handleDeleteTask}
                      onUpdate={handleUpdateTask}
                    />
                  ))}
                </Box>
              </SortableContext>

              {/* Yeni Görev Ekleme Alanı */}
              {activeColumnId === column.id ? (
                <VStack spaceY={2} mt={3} align="stretch">
                  <Input
                    placeholder="Görev Başlığı"
                    size="sm"
                    bg="white"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    autoFocus
                  />
                  <Input
                    placeholder="Açıklama (İsteğe bağlı)"
                    size="sm"
                    bg="white"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    style={{
                      padding: '6px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid #E2E8F0',
                      background: 'white',
                    }}
                  >
                    <option value="">Atanan Kişi Seç (İsteğe bağlı)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>

                  <HStack justifyContent="flex-end">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setActiveColumnId(null)}
                    >
                      İptal
                    </Button>
                    <Button
                      size="xs"
                      colorPalette="blue"
                      variant="solid"
                      onClick={() => handleCreateTask(column.id)}
                    >
                      Ekle
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  width="full"
                  mt={2}
                  onClick={() => {
                    setActiveColumnId(column.id);
                    setTaskTitle('');
                    setTaskDescription('');
                    setTaskAssigneeId('');
                  }}
                >
                  + Yeni Görev Ekle
                </Button>
              )}
            </Box>
          ))}
        </Flex>
      </DndContext>
    </Box>
  );
};