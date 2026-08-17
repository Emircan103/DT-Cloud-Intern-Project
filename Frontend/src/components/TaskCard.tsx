import React from 'react';
import { Box, Heading, Text, Flex, Button } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  columnId: string;
  assignee?: {
    id: string;
    email: string;
  } | null;
}

interface TaskCardProps {
  task: TaskItem;
  onDelete: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDelete }) => {
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
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

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
        <Button
          size="xs"
          colorPalette="red"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
        >
          ✕
        </Button>
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