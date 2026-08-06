import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';

interface UserSessionInfo {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: UserSessionInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await apiRequest<UserSessionInfo>('/api/auth/me');
      setUser(data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiRequest<UserSessionInfo>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setUser(data);
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Ignorar error si la sesión ya no existía
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
