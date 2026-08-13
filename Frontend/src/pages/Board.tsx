import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Input, 
  Heading, 
  Text, 
  Flex,
  HStack,
  VStack
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

export const Board = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [boardName, setBoardName] = useState('');
  const [error, setError] = useState('');

  // Pano Güncelleme (Edit) Durumları
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState('');

  const fetchProjectData = useCallback(async () => {
    if (!id) return;

    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Proje verisi yüklenemedi.');
      }
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!id) return;

      try {
        const res = await api.get(`/projects/${id}`);
        if (isMounted) {
          setProject(res.data);
        }
      } catch (err: unknown) {
        if (isMounted && axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Proje verisi yüklenemedi.');
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !boardName.trim()) return;

    setError('');

    try {
      await api.post('/boards', { 
        name: boardName,
        projectId: id 
      });

      setBoardName('');
      await fetchProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano oluşturulamadı.');
      }
    }
  };

  const startEditingBoard = (board: BoardItem) => {
    setEditingBoardId(board.id);
    setEditBoardName(board.name);
  };

  const cancelEditingBoard = () => {
    setEditingBoardId(null);
    setEditBoardName('');
  };

  const handleUpdateBoard = async (boardId: string) => {
    if (!editBoardName.trim()) return;
    setError('');

    try {
      await api.put(`/boards/${boardId}`, {
        name: editBoardName
      });

      setEditingBoardId(null);
      await fetchProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano güncellenemedi.');
      }
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await api.delete(`/boards/${boardId}`);
      await fetchProjectData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Pano silinemedi.');
      }
    }
  };

  return (
    <Box maxW="5xl" mx="auto" mt={8} p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Box>
          <Button 
            size="sm" 
            variant="outline" 
            mb={2} 
            onClick={() => navigate('/projects')}
          >
            ← Projelere Dön
          </Button>

          <Heading size="xl">
            {project?.name || 'Proje Panosu'}
          </Heading>

          {project?.description && (
            <Text color="gray.600" mt={1}>
              {project.description}
            </Text>
          )}
        </Box>
      </Flex>

      {error && (
        <Box p={3} bg="red.100" color="red.700" borderRadius="md" mb={4}>
          <Text fontWeight="bold">{error}</Text>
        </Box>
      )}

      {/* Pano Ekleme Formu */}
      <Box p={4} borderWidth={1} borderRadius="lg" mb={8}>
        <Heading size="md" mb={4}>
          Yeni Pano / Kolon Ekle
        </Heading>

        <HStack as="form" onSubmit={handleCreateBoard}>
          <Input
            placeholder="Pano Adı (örn: Yapılacaklar, Tamamlananlar)"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            required
          />

          <Button type="submit" colorPalette="blue" variant="solid">
            Ekle
          </Button>
        </HStack>
      </Box>

      {/* Panolar Listesi */}
      <Heading size="md" mb={4}>
        Panolar
      </Heading>

      <Flex gap={4} overflowX="auto" pb={4}>
        {!project?.boards || project.boards.length === 0 ? (
          <Text color="gray.500">Henüz pano eklenmemiş.</Text>
        ) : (
          project.boards.map((board) => (
            <Box 
              key={board.id} 
              minW="300px" 
              p={4} 
              borderWidth={1} 
              borderRadius="lg" 
              bg="gray.50"
            >
              {editingBoardId === board.id ? (
                /* Düzenleme Modu */
                <VStack spaceY={2} align="stretch">
                  <Input
                    value={editBoardName}
                    onChange={(e) => setEditBoardName(e.target.value)}
                    size="sm"
                    bg="white"
                  />

                  <HStack justifyContent="flex-end">
                    <Button size="xs" variant="outline" onClick={cancelEditingBoard}>
                      İptal
                    </Button>

                    <Button 
                      size="xs" 
                      colorPalette="green" 
                      variant="solid" 
                      onClick={() => handleUpdateBoard(board.id)}
                    >
                      Kaydet
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                /* Normal Görünüm */
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="sm">
                    {board.name}
                  </Heading>

                  <HStack spaceX={1}>
                    <Button 
                      size="xs" 
                      colorPalette="yellow" 
                      variant="solid" 
                      onClick={() => startEditingBoard(board)}
                    >
                      Düzenle
                    </Button>

                    <Button 
                      size="xs" 
                      colorPalette="red" 
                      variant="solid" 
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
      </Flex>
    </Box>
  );
};