import React from 'react';
import { Box, Heading, Flex, Button, Input, VStack, HStack } from '@chakra-ui/react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard, type TaskItem, type TaskUser } from './TaskCard';

export interface ColumnItem {
  id: string;
  name: string;
  order: number;
  tasks: TaskItem[];
}

interface DroppableColumnProps {
  column: ColumnItem;
  users: TaskUser[];
  activeColumnId: string | null;
  taskTitle: string;
  taskDescription: string;
  taskAssigneeId: string;
  onSetActiveColumnId: (id: string | null) => void;
  onSetTaskTitle: (val: string) => void;
  onSetTaskDescription: (val: string) => void;
  onSetTaskAssigneeId: (val: string) => void;
  onCreateTask: (columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (
    taskId: string,
    data: { title: string; description?: string; assigneeId?: string | null }
  ) => void;
}

export const DroppableColumn: React.FC<DroppableColumnProps> = ({
  column,
  users,
  activeColumnId,
  taskTitle,
  taskDescription,
  taskAssigneeId,
  onSetActiveColumnId,
  onSetTaskTitle,
  onSetTaskDescription,
  onSetTaskAssigneeId,
  onCreateTask,
  onDeleteTask,
  onUpdateTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  return (
    <Box
      ref={setNodeRef}
      minW="320px"
      maxW="320px"
      bg={isOver ? 'blue.50' : 'gray.100'}
      p={4}
      borderRadius="lg"
      boxShadow="sm"
      transition="background-color 0.2s"
    >
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="sm" color="gray.700">
          {column.name} ({column.tasks.length})
        </Heading>
      </Flex>

      <SortableContext
        items={column.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <Box minH="120px">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              users={users}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
            />
          ))}
        </Box>
      </SortableContext>

      {activeColumnId === column.id ? (
        <VStack spaceY={2} mt={3} align="stretch">
          <Input
            placeholder="Görev Başlığı"
            size="sm"
            bg="white"
            value={taskTitle}
            onChange={(e) => onSetTaskTitle(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Açıklama (İsteğe bağlı)"
            size="sm"
            bg="white"
            value={taskDescription}
            onChange={(e) => onSetTaskDescription(e.target.value)}
          />
          <select
            value={taskAssigneeId}
            onChange={(e) => onSetTaskAssigneeId(e.target.value)}
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
            <Button size="xs" variant="outline" onClick={() => onSetActiveColumnId(null)}>
              İptal
            </Button>
            <Button
              size="xs"
              colorPalette="blue"
              variant="solid"
              onClick={() => onCreateTask(column.id)}
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
            onSetActiveColumnId(column.id);
            onSetTaskTitle('');
            onSetTaskDescription('');
            onSetTaskAssigneeId('');
          }}
        >
          + Yeni Görev Ekle
        </Button>
      )}
    </Box>
  );
};