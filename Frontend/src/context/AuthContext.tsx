import { createContext, useContext, useState, type ReactNode } from 'react';

// AuthContext'in içerisinde hangi bilgilerin ve fonksiyonların
// bulunacağını TypeScript'e tanımlıyoruz
interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

// Authentication bilgilerinin paylaşılacağı Context'i oluşturuyoruz.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider, içerisine aldığı tüm componentlere
// authentication bilgilerini (token, login, logout) sağlar.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // AuthContext içerisindeki bilgileri uygulamanın
  // altındaki componentlere gönderiyoruz.
  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth hook'u, AuthContext içerisindeki bilgilere kolayca erişim sağlar.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};