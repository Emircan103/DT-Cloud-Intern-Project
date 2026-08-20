import React, { useState } from 'react';
import { Box, Text, Flex, IconButton, Input, VStack, HStack } from '@chakra-ui/react';
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
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: { title: string; description?: string; assigneeId?: string | null }
  ) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, users, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editAssigneeId, setEditAssigneeId] = useState(task.assigneeId || '');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      assigneeId: editAssigneeId || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditAssigneeId(task.assigneeId || '');
    setIsEditing(false);
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      p={3}
      bg="white"
      borderRadius="md"
      boxShadow="sm"
      mb={3}
      cursor={isEditing ? 'default' : 'grab'}
      _hover={{ boxShadow: 'md' }}
    >
      {isEditing ? (
        <VStack gap={2} align="stretch">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            size="sm"
            placeholder="Görev başlığı"
            autoFocus
          />
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            size="sm"
            placeholder="Açıklama (İsteğe bağlı)"
          />
          <select
            value={editAssigneeId}
            onChange={(e) => setEditAssigneeId(e.target.value)}
            style={{
              padding: '6px',
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
          <HStack justifyContent="flex-end">
            <IconButton size="xs" variant="outline" onClick={handleCancel} aria-label="İptal">
              ✕
            </IconButton>
            <IconButton
              size="xs"
              colorPalette="blue"
              variant="solid"
              onClick={handleSave}
              aria-label="Kaydet"
            >
              ✓
            </IconButton>
          </HStack>
        </VStack>
      ) : (
        <>
          <Flex justifyContent="space-between" alignItems="flex-start">
            <Text fontWeight="medium" fontSize="sm" color="gray.800">
              {task.title}
            </Text>
            <HStack gap={1}>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                aria-label="Düzenle"
              >
                ✎
              </IconButton>
              <IconButton
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => onDelete(task.id)}
                aria-label="Sil"
              >
                ✕
              </IconButton>
            </HStack>
          </Flex>

          {task.description && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              {task.description}
            </Text>
          )}

          {task.assignee && (
            <Box
              mt={2}
              display="inline-block"
              bg="blue.50"
              color="blue.700"
              px={2}
              py={0.5}
              borderRadius="full"
              fontSize="10px"
              fontWeight="semibold"
            >
              👤 {task.assignee.email}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};