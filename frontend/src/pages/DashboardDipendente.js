// Dashboard Dipendente - CORRETTA per permessi
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStatoSettimana, checkScadenzaPreferenze } from '../api/axios';
import WeekTable from '../components/WeekTable';
import PreferenzeForm from '../components/PreferenzeForm';
import CalendarioFerie from '../components/CalendarioFerie';
import StatoSettimanaBar from '../components/StatoSettimanaBar';
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

  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 7);

  const futureMonday = new Date(nextMonday);
  futureMonday.setDate(nextMonday.getDate() + 7);
  
  const [viewMode, setViewMode] = useState('turni');
  const [selectedWeek, setSelectedWeek] = useState(currentMonday.toISOString().split('T')[0]);
  const [statoSettimana, setStatoSettimana] = useState(null);
  const [scadenzaPreferenze, setScadenzaPreferenze] = useState(null);

  useEffect(() => {
    loadStatoSettimana();
  }, [selectedWeek]);

  useEffect(() => {
    if (viewMode === 'preferenze') {
      checkScadenza();
    }
  }, [viewMode]);

  const loadStatoSettimana = async () => {
    try {
      const response = await getStatoSettimana(selectedWeek);
      setStatoSettimana(response.data.stato);
    } catch (err) {
      console.error('Errore caricamento stato:', err);
      setStatoSettimana('pianificazione');
    }
  };

  const checkScadenza = async () => {
    try {
      const response = await checkScadenzaPreferenze(nextMonday.toISOString().split('T')[0]);
      setScadenzaPreferenze(response.data);
    } catch (err) {
      console.error('Errore check scadenza:', err);
    }
  };

  const formatWeekRange = (mondayDate) => {
    const monday = new Date(mondayDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
  };

  const isSettimanaVisibile = () => {
    // Pianificazione = non visibile ai dipendenti
    if (statoSettimana === 'pianificazione') {
      return false;
    }
    // Tutti gli altri stati = visibile
    return true;
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
        <button 
          className={`tab ${viewMode === 'ferie' ? 'active' : ''}`}
          onClick={() => setViewMode('ferie')}
        >
          🏖️ Richiedi Ferie
        </button>
      </div>

      {/* Contenuto */}
      <div className="dashboard-content">
        {viewMode === 'turni' && (
          <div className="turni-view">
            <div className="week-selector">
              <button 
                className={`week-btn ${selectedWeek === previousMonday.toISOString().split('T')[0] ? 'active' : ''}`}
                onClick={() => setSelectedWeek(previousMonday.toISOString().split('T')[0])}
              >
                {formatWeekRange(previousMonday)}<br/>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>(Passata)</span>
              </button>
              <button 
                className={`week-btn ${selectedWeek === currentMonday.toISOString().split('T')[0] ? 'active' : ''}`}
                onClick={() => setSelectedWeek(currentMonday.toISOString().split('T')[0])}
              >
                {formatWeekRange(currentMonday)}<br/>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>(Corrente)</span>
              </button>
              <button 
                className={`week-btn ${selectedWeek === nextMonday.toISOString().split('T')[0] ? 'active' : ''}`}
                onClick={() => setSelectedWeek(nextMonday.toISOString().split('T')[0])}
              >
                {formatWeekRange(nextMonday)}<br/>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>(Prossima)</span>
              </button>
              <button 
                className={`week-btn ${selectedWeek === futureMonday.toISOString().split('T')[0] ? 'active' : ''}`}
                onClick={() => setSelectedWeek(futureMonday.toISOString().split('T')[0])}
              >
                {formatWeekRange(futureMonday)}<br/>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>(Futura)</span>
              </button>
            </div>

            {/* Barra Stato Settimana */}
            <StatoSettimanaBar settimana={selectedWeek} />

            {isSettimanaVisibile() ? (
              <WeekTable settimana={selectedWeek} editable={false} />
            ) : (
              <div className="info-card info-warning">
                <h4>⏳ Settimana in Pianificazione</h4>
                <p>
                  La pianificazione per questa settimana è ancora in corso.
                  Verrà pubblicata dall'amministratore non appena completata.
                </p>
              </div>
            )}
            
            <div className="info-card">
              <h4>ℹ️ Informazioni</h4>
              <p>
                <strong>Pianificazione:</strong> Settimana non ancora visibile<br/>
                <strong>Bozza:</strong> Pianificazione pubblicata, potrebbe subire modifiche<br/>
                <strong>Confermata:</strong> In attesa di autorizzazione manager<br/>
                <strong>Autorizzata:</strong> Pianificazione definitiva approvata
              </p>
            </div>
          </div>
        )}

        {viewMode === 'preferenze' && (
          <div className="preferenze-view">
            {scadenzaPreferenze && scadenzaPreferenze.scaduta ? (
              <div className="info-card" style={{ background: '#f8d7da', borderLeft: '4px solid #dc3545' }}>
                <h4 style={{ color: '#721c24' }}>🔒 Scadenza Superata</h4>
                <p style={{ color: '#721c24' }}>
                  Le preferenze per la prossima settimana non sono più modificabili.
                  La scadenza era <strong>mercoledì alle 21:59</strong>.
                </p>
              </div>
            ) : (
              <>
                <div className="info-card info-warning">
                  <h4>⚠️ Scadenza inserimento preferenze</h4>
                  <p>
                    Le preferenze per la prossima settimana devono essere inserite entro 
                    <strong> mercoledì alle 21:59</strong>. Dopo tale orario non sarà più possibile 
                    modificarle.
                  </p>
                </div>

                <PreferenzeForm settimana={nextMonday.toISOString().split('T')[0]} />
              </>
            )}
          </div>
        )}

        {viewMode === 'ferie' && (
          <div className="ferie-view">
            <CalendarioFerie />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardDipendente;