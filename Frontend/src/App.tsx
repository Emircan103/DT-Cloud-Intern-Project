import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { useAuth } from './context/AuthContext';

// Oturum açılmamışsa Login sayfasına yönlendiren korumalı rota
const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={<Login />} 
      />

      <Route 
        path="/register" 
        element={<Register />} 
      />

      <Route
        path="/projects"
        element={
          <PrivateRoute>
            <div style={{ padding: 20 }}>
              Projeler Sayfası (Yakında)
            </div>
          </PrivateRoute>
        }
      />

      <Route 
        path="*" 
        element={<Navigate to="/login" />} 
      />
    </Routes>
  );
}

export default App;