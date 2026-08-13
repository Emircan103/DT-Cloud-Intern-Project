import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Projects } from './pages/Projects';
import { Board } from './pages/Board';
import { useAuth } from './context/AuthContext';

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
            <Projects />
          </PrivateRoute>
        }
      />

      <Route
        path="/projects/:id"
        element={
          <PrivateRoute>
            <Board />
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