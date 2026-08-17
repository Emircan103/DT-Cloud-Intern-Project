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
import { api } from '../lib/axios';

interface BoardItem {
  id: string;
  name: string;
  projectId: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  boards?: BoardItem[];
}

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [boardName, setBoardName] = useState('');
  const [error, setError] = useState('');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState('');

  const refreshProjectData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Proje yüklenemedi.');
      }
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;

    const loadProject = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/projects/${id}`);
        if (!ignore) {
          setProject(res.data);
        }
      } catch (err: unknown) {
        if (!ignore && axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Proje yüklenemedi.');
        }
      }
    };

    loadProject();

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !boardName.trim()) return;

    try {
      await api.post('/boards', { name: boardName, projectId: id });
      setBoardName('');
      await refreshProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano oluşturulamadı.');
      }
    }
  };

  const handleUpdateBoard = async (boardId: string) => {
    if (!editBoardName.trim()) return;
    try {
      await api.put(`/boards/${boardId}`, { name: editBoardName });
      setEditingBoardId(null);
      await refreshProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano güncellenemedi.');
      }
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await api.delete(`/boards/${boardId}`);
      await refreshProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano silinemedi.');
      }
    }
  };

  return (
    <Box maxW="5xl" mx="auto" mt={8} p={4}>
      <Button size="sm" variant="outline" mb={4} onClick={() => navigate('/projects')}>
        ← Projelere Dön
      </Button>

      <Heading size="xl">{project?.name || 'Proje Detayı'}</Heading>
      {project?.description && <Text color="gray.600" mt={1}>{project.description}</Text>}

      {error && (
        <Box p={3} bg="red.100" color="red.700" borderRadius="md" my={4}>
          <Text fontWeight="bold">{error}</Text>
        </Box>
      )}

      <Box p={4} borderWidth={1} borderRadius="lg" my={6}>
        <Heading size="md" mb={4}>Yeni Pano Ekle</Heading>
        <HStack as="form" onSubmit={handleCreateBoard}>
          <Input
            placeholder="Pano Adı (örn: Sprint 1, Backend Ekibi)"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            required
          />
          <Button type="submit" colorPalette="blue">Ekle</Button>
        </HStack>
      </Box>

      <Heading size="md" mb={4}>Proje Panoları</Heading>
      <VStack spaceY={3} align="stretch">
        {!project?.boards || project.boards.length === 0 ? (
          <Text color="gray.500">Henüz pano eklenmemiş. Yukarıdaki formdan bir pano oluşturun.</Text>
        ) : (
          project.boards.map((board) => (
            <Box key={board.id} p={4} borderWidth={1} borderRadius="md" bg="white">
              {editingBoardId === board.id ? (
                <HStack>
                  <Input
                    value={editBoardName}
                    onChange={(e) => setEditBoardName(e.target.value)}
                  />
                  <Button size="sm" onClick={() => setEditingBoardId(null)}>İptal</Button>
                  <Button size="sm" colorPalette="green" onClick={() => handleUpdateBoard(board.id)}>
                    Kaydet
                  </Button>
                </HStack>
              ) : (
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="sm">{board.name}</Heading>
                  <HStack>
                    <Button
                      size="sm"
                      colorPalette="purple"
                      onClick={() => navigate(`/boards/${board.id}`)}
                    >
                      Kanban Tahtasını Aç ➔
                    </Button>
                    <Button
                      size="sm"
                      colorPalette="yellow"
                      onClick={() => {
                        setEditingBoardId(board.id);
                        setEditBoardName(board.name);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      colorPalette="red"
                      onClick={() => handleDeleteBoard(board.id)}
                    >
                      Sil
                    </Button>
                  </HStack>
                </Flex>
              )}
            </Box>
          ))
        )}
      </VStack>
    </Box>
  );
};