import React, { useState } from 'react';
import { Box, Heading, Text, Flex, Button, Input, VStack, HStack } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface TaskUser {
  id: string;
  email: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  columnId: string;
  assigneeId?: string | null;
  assignee?: TaskUser | null;
}

interface TaskCardProps {
  task: TaskItem;
  users: TaskUser[];
  onDelete: (taskId: string) => void;
  onUpdate: (taskId: string, updatedData: { title: string; description?: string; assigneeId?: string | null }) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, users, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editAssigneeId, setEditAssigneeId] = useState(task.assigneeId || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
    disabled: isEditing, // Düzenleme modundayken sürüklemeyi devre dışı bırak
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    onUpdate(task.id, {
      title: editTitle,
      description: editDescription,
      assigneeId: editAssigneeId || null,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Box
        ref={setNodeRef}
        style={style}
        p={3}
        bg="white"
        borderWidth={2}
        borderColor="blue.400"
        borderRadius="md"
        mb={2}
      >
        <VStack spaceY={2} align="stretch">
          <Input
            size="xs"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Görev başlığı"
            bg="white"
          />
          <Input
            size="xs"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Açıklama"
            bg="white"
          />
          <select
            value={editAssigneeId}
            onChange={(e) => setEditAssigneeId(e.target.value)}
            style={{
              padding: '4px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #E2E8F0',
              background: 'white',
            }}
          >
            <option value="">Atanan Kişi Yok</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>

          <HStack justifyContent="flex-end" spaceX={1}>
            <Button size="xs" variant="outline" onClick={() => setIsEditing(false)}>
              İptal
            </Button>
            <Button size="xs" colorPalette="green" onClick={handleSave}>
              Kaydet
            </Button>
          </HStack>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      p={3}
      bg="white"
      borderWidth={1}
      borderRadius="md"
      boxShadow="sm"
      cursor="grab"
      _hover={{ boxShadow: 'md' }}
      mb={2}
    >
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Heading size="xs" color="gray.800">
          {task.title}
        </Heading>
        <HStack spaceX={1}>
          <Button
            size="2xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            ✎
          </Button>
          <Button
            size="2xs"
            colorPalette="red"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
          >
            ✕
          </Button>
        </HStack>
      </Flex>

      {task.description && (
        <Text fontSize="xs" color="gray.600" mt={1}>
          {task.description}
        </Text>
      )}

      {task.assignee && (
        <Text fontSize="2xs" color="blue.600" mt={2} fontWeight="bold">
          👤 {task.assignee.email}
        </Text>
      )}
    </Box>
  );
};