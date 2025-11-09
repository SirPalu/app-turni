// Dashboard Dipendente - Completa
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import WeekTable from '../components/WeekTable';
import PreferenzeForm from '../components/PreferenzeForm';
import './Dashboard.css';

const DashboardDipendente = () => {
  const { user, logout } = useAuth();
  
  // Calcola lunedì corrente e prossimo
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  currentMonday.setHours(0, 0, 0, 0);
  
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);
  
  const [viewMode, setViewMode] = useState('turni'); // 'turni' o 'preferenze'
  const [selectedWeek, setSelectedWeek] = useState(currentMonday.toISOString().split('T')[0]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard Dipendente</h1>
          <p className="welcome-text">
            Benvenuto, <strong>{user?.nome}</strong>!
          </p>
          <div className="user-info">
            <span className="info-badge">📋 {user?.ore_settimanali}h/settimana</span>
            <span className="info-badge">
              {user?.ha_chiavi ? '🔑 Con chiavi' : '❌ Senza chiavi'}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      {/* Navigazione Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab ${viewMode === 'turni' ? 'active' : ''}`}
          onClick={() => setViewMode('turni')}
        >
          📅 I Miei Turni
        </button>
        <button 
          className={`tab ${viewMode === 'preferenze' ? 'active' : ''}`}
          onClick={() => setViewMode('preferenze')}
        >
          🎯 Inserisci Preferenze
        </button>
      </div>

      {/* Contenuto */}
      <div className="dashboard-content">
        {viewMode === 'turni' && (
          <div className="turni-view">
            <div className="week-selector">
              <button 
                className="week-btn"
                onClick={() => setSelectedWeek(currentMonday.toISOString().split('T')[0])}
              >
                Settimana Corrente
              </button>
              <button 
                className="week-btn"
                onClick={() => setSelectedWeek(nextMonday.toISOString().split('T')[0])}
              >
                Prossima Settimana
              </button>
            </div>

            <WeekTable settimana={selectedWeek} editable={false} />
            
            <div className="info-card">
              <h4>ℹ️ Informazioni</h4>
              <p>Qui puoi visualizzare i tuoi turni pianificati. La settimana corrente mostra 
              i turni confermati, mentre la prossima settimana potrebbe essere ancora in fase 
              di pianificazione.</p>
            </div>
          </div>
        )}

        {viewMode === 'preferenze' && (
          <div className="preferenze-view">
            <div className="info-card info-warning">
              <h4>⚠️ Scadenza inserimento preferenze</h4>
              <p>
                Le preferenze per la prossima settimana devono essere inserite entro 
                <strong> lunedì alle 21:59</strong>. Dopo tale orario non sarà più possibile 
                modificarle.
              </p>
            </div>

            <PreferenzeForm settimana={nextMonday.toISOString().split('T')[0]} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardDipendente;