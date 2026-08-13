import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';

// ReactNode kullanarak JSX tür hatasını çözüyoruz
const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<div style={{ padding: 20 }}>Giriş Sayfası (Geçici)</div>} />
      <Route path="/register" element={<div style={{ padding: 20 }}>Kayıt Sayfası (Geçici)</div>} />
      <Route
        path="/projects"
        element={
          <PrivateRoute>
            <div style={{ padding: 20 }}>Projeler Sayfası (Yakında)</div>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;