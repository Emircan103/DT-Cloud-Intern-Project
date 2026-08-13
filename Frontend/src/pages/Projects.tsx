import { useState, useEffect } from 'react';
import { Box, Button, Input, VStack, Heading, Text, Flex,HStack } from '@chakra-ui/react';
import axios from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string;
  name: string;
  description?: string;
}

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { logout } = useAuth();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Projeler yüklenemedi.');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const res = await api.get('/projects');
        if (isMounted) {
          setProjects(res.data);
        }
      } catch (err: unknown) {
        if (isMounted && axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Projeler yüklenemedi.');
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      await fetchProjects();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Proje oluşturulamadı.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`);
      await fetchProjects();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Proje silinemedi.');
      }
    }
  };

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (id: string) => {
    setError('');

    try {
      await api.put(`/projects/${id}`, { 
        name: editName, 
        description: editDescription 
      });
      setEditingId(null);
      await fetchProjects();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Proje güncellenemedi.');
      }
    }
  };

  return (
    <Box maxW="4xl" mx="auto" mt={8} p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="xl">
          Projelerim
        </Heading>

        <Button colorPalette="red" variant="solid" onClick={logout}>
          Çıkış Yap
        </Button>
      </Flex>

      {error && (
        <Text color="red.500" mb={4}>
          {error}
        </Text>
      )}

      {/* Proje Ekleme Formu */}
      <Box p={4} borderWidth={1} borderRadius="lg" mb={8}>
        <Heading size="md" mb={4}>
          Yeni Proje Oluştur
        </Heading>

        <VStack spaceY={3} as="form" onSubmit={handleCreate}>
          <Input
            placeholder="Proje Adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            placeholder="Açıklama (İsteğe bağlı)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Button type="submit" colorPalette="blue" variant="solid" width="full">
            Ekle
          </Button>
        </VStack>
      </Box>

      {/* Proje Listesi */}
      <VStack spaceY={4} align="stretch">
        {projects.length === 0 ? (
          <Text color="gray.500">Henüz hiç projen yok.</Text>
        ) : (
          projects.map((project) => (
            <Box key={project.id} p={4} borderWidth={1} borderRadius="md">
              {editingId === project.id ? (
                /* Düzenleme Modu Formu */
                <VStack spaceY={3} align="stretch">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Proje Adı"
                  />

                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Açıklama"
                  />

                  <HStack justifyContent="flex-end">
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      İptal
                    </Button>

                    <Button 
                      size="sm" 
                      colorPalette="green" 
                      variant="solid"
                      onClick={() => handleUpdate(project.id)}
                    >
                      Kaydet
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                /* Normal Görünüm */
                <Flex justifyContent="space-between" alignItems="center">
                  <Box>
                    <Heading size="sm">
                      {project.name}
                    </Heading>

                    {project.description && (
                      <Text fontSize="sm" color="gray.600" mt={1}>
                        {project.description}
                      </Text>
                    )}
                  </Box>

                  <HStack>
                    <Button 
                      colorPalette="yellow" 
                      variant="solid"
                      size="sm" 
                      onClick={() => startEditing(project)}
                    >
                      Düzenle
                    </Button>

                    <Button 
                      colorPalette="red" 
                      variant="solid"
                      size="sm" 
                      onClick={() => handleDelete(project.id)}
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