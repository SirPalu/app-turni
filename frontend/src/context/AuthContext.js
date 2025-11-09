// Context per gestione autenticazione globale
import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/axios';

const AuthContext = createContext();

// Hook personalizzato per usare l'auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato dentro AuthProvider');
  }
  return context;
};

// Provider che avvolge l'intera app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Al caricamento, verifica se c'è un token salvato
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          // Verifica che il token sia ancora valido
          const response = await getMe();
          setUser(response.data.user);
        } catch (error) {
          console.error('Token non valido:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Funzione login
  const login = async (username, password) => {
    try {
      setError(null);
      const response = await apiLogin(username, password);
      
      const { token, user } = response.data;
      
      // Salva token e user in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Errore di login';
      setError(message);
      return { success: false, error: message };
    }
  };

  // Funzione logout
  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Errore logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  // Verifica ruolo utente
  const hasRole = (role) => {
    return user?.ruolo === role;
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    hasRole,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;