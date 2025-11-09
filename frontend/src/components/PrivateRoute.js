// Componente per proteggere route che richiedono autenticazione
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  // Mostra loading mentre verifica autenticazione
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  // Non autenticato → redirect a login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Autenticato ma ruolo sbagliato → redirect a dashboard appropriata
  if (requiredRole && user.ruolo !== requiredRole) {
    // Reindirizza alla dashboard corretta in base al ruolo
    const dashboardMap = {
      dipendente: '/dashboard',
      amministratore: '/admin',
      manager: '/manager',
    };
    return <Navigate to={dashboardMap[user.ruolo] || '/dashboard'} replace />;
  }

  // Tutto OK → mostra contenuto
  return children;
};

export default PrivateRoute;