// App principale con routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import DashboardDipendente from './pages/DashboardDipendente';
import DashboardAmministratore from './pages/DashboardAmministratore';
import DashboardManager from './pages/DashboardManager';
import './App.css';

// Componente per redirect automatico alla dashboard corretta
const AutoRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect in base al ruolo
  const dashboardMap = {
    dipendente: '/dashboard',
    amministratore: '/admin',
    manager: '/manager',
  };

  return <Navigate to={dashboardMap[user.ruolo] || '/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Route pubblica - Login */}
            <Route path="/login" element={<Login />} />

            {/* Route protette */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute requiredRole="dipendente">
                  <DashboardDipendente />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <PrivateRoute requiredRole="amministratore">
                  <DashboardAmministratore />
                </PrivateRoute>
              }
            />

            <Route
              path="/manager"
              element={
                <PrivateRoute requiredRole="manager">
                  <DashboardManager />
                </PrivateRoute>
              }
            />

            {/* Home - redirect automatico */}
            <Route path="/" element={<AutoRedirect />} />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;