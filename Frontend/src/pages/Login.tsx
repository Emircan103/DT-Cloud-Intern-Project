import { useState } from 'react';
import { Box, Button, Input, VStack, Heading, Text } from '@chakra-ui/react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token);
      navigate('/projects');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Giriş yapılamadı.');
      } else {
        setError('Beklenmeyen bir hata oluştu.');
      }
    }
  };

  return (
    <Box 
      maxW="md" 
      mx="auto" 
      mt={10} 
      p={6} 
      borderWidth={1} 
      borderRadius="lg"
    >
      <VStack spaceY={4} as="form" onSubmit={handleSubmit}>
        <Heading size="lg">
          Giriş Yap
        </Heading>

        {error && (
          <Text color="red.500">
            {error}
          </Text>
        )}

        <Input
          placeholder="E-posta"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          placeholder="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button 
          type="submit" 
          colorPalette="blue" 
          variant="solid" 
          width="full"
        >
          Giriş Yap
        </Button>

        <Text fontSize="sm">
          Hesabın yok mu?{' '}
          <Link 
            to="/register" 
            style={{ color: '#3182ce', fontWeight: 'bold' }}
          >
            Kayıt Ol
          </Link>
        </Text>
      </VStack>
    </Box>
  );
};