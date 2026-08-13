import { useState } from 'react';
import { 
  Box, 
  Button, 
  Input, 
  VStack, 
  Heading, 
  Text 
} from '@chakra-ui/react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '../lib/axios';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/auth/register', { email, password });
      navigate('/login');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Kayıt olunamadı.');
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
          Kayıt Ol
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
          colorScheme="green" 
          width="full"
        >
          Kayıt Ol
        </Button>

        <Text fontSize="sm">
          Zaten hesabın var mı?{' '}
          <Link 
            to="/login" 
            style={{ color: '#3182ce', fontWeight: 'bold' }}
          >
            Giriş Yap
          </Link>
        </Text>
      </VStack>
    </Box>
  );
};