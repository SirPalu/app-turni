// Dashboard Amministratore - Completa con tutte le funzionalità
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllUsers, 
  getPreferenze,
  generaPianificazioneAutomatica,
  importaPreferenze,
  resetSettimana,
  getConfigPresidio,
  updatePresidioGiorno
} from '../api/axios';
import WeekTable from '../components/WeekTable';
import TurnoModal from '../components/TurnoModal';
import ValidazioniPanel from '../components/ValidazioniPanel';
import './Dashboard.css';
import './DashboardAmministratore.css';

const DashboardAmministratore = () => {
  const { user, logout } = useAuth();
  
  // Calcola lunedì corrente e prossimo
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  currentMonday.setHours(0, 0, 0, 0);
  
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);
  
  const [selectedWeek, setSelectedWeek] = useState(nextMonday.toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('pianifica');
  const [utenti, setUtenti] = useState([]);
  const [preferenzeUtenti, setPreferenzeUtenti] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [preferenzeImportate, setPreferenzeImportate] = useState(false);
  const [generandoPiano, setGenerandoPiano] = useState(false);
  const [configPresidio, setConfigPresidio] = useState({});
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState(null);

  useEffect(() => {
    loadUtenti();
    if (viewMode === 'preferenze') {
      loadAllPreferenze();
    }
  }, [viewMode, selectedWeek]);

  useEffect(() => {
    loadConfigPresidio();
  }, [selectedWeek]);

  const loadUtenti = async () => {
    try {
      const response = await getAllUsers();
      setUtenti(response.data.users);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
    }
  };

  const loadAllPreferenze = async () => {
    try {
      const promises = utenti.map(u => 
        getPreferenze(u.id, selectedWeek)
          .then(res => ({ userId: u.id, preferenze: res.data.preferenze }))
          .catch(() => ({ userId: u.id, preferenze: [] }))
      );
      
      const results = await Promise.all(promises);
      
      const prefMap = {};
      results.forEach(({ userId, preferenze }) => {
        prefMap[userId] = preferenze;
      });
      
      setPreferenzeUtenti(prefMap);
    } catch (err) {
      console.error('Errore caricamento preferenze:', err);
    }
  };

  const loadConfigPresidio = async () => {
    try {
      const response = await getConfigPresidio(selectedWeek);
      setConfigPresidio(response.data.presidio);
    } catch (err) {
      console.error('Errore caricamento config presidio:', err);
      // Set default se errore
      setConfigPresidio({
        0: 'base', 1: 'base', 2: 'base', 3: 'base', 4: 'base',
        5: 'rinforzato', 6: 'rinforzato'
      });
    }
  };

  const handleTurnoClick = (userId, giorno, turnoEsistente) => {
    const utente = utenti.find(u => u.id === userId);
    
    setSelectedTurno({
      userId,
      userName: utente?.nome || 'Unknown',
      giorno,
      turnoEsistente
    });
    
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTurno(null);
  };

  const handleTurnoSave = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleImportaPreferenze = async () => {
    if (!window.confirm('Importare le preferenze dei dipendenti nella tabella turni?\n\nLe celle vuote verranno riempite con le preferenze indicate.')) {
      return;
    }

    try {
      const response = await importaPreferenze(selectedWeek);
      if (response.data.turniImportati === 0 && response.data.totalePreferenze === 0) {
      alert('ℹ️ Nessuna preferenza da importare.\n\nPuoi comunque procedere con la pianificazione manuale o automatica.');
    } else {
           alert(`✅ ${response.data.turniImportati} preferenze importate!\n(${response.data.turniEsistentiSkip} turni già esistenti saltati)`);
      }
           setPreferenzeImportate(true);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('❌ Errore: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAutoGenera = async () => {
   

    if (!window.confirm('Vuoi generare automaticamente la pianificazione?\n\nI turni già inseriti verranno mantenuti.')) {
      return;
    }

    try {
      setGenerandoPiano(true);
      
      const response = await generaPianificazioneAutomatica(selectedWeek, { presidio: configPresidio });
      
      alert(`✅ Pianificazione generata!\n\n${response.data.turniGenerati} turni creati\nOre medie: ${response.data.statistiche.ore_medie}h`);
      
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Errore generazione:', err);
      alert('❌ Errore nella generazione automatica: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerandoPiano(false);
    }
  };

  const handleResetSettimana = async () => {
    if (!window.confirm('⚠️ ATTENZIONE!\n\nQuesto cancellerà TUTTI i turni della settimana.\n\nSei sicuro?')) {
      return;
    }

    try {
      const response = await resetSettimana(selectedWeek);
      alert(`✅ Settimana resettata!\n${response.data.turniEliminati} turni eliminati`);
      setPreferenzeImportate(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('❌ Errore reset: ' + err.message);
    }
  };

  const handleChangePresidio = async (giorno, nuovoTipo) => {
    try {
      await updatePresidioGiorno(selectedWeek, giorno, nuovoTipo);
      setConfigPresidio(prev => ({ ...prev, [giorno]: nuovoTipo }));
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Errore cambio presidio:', err);
    }
  };

  const renderPreferenzeGrid = () => {
    const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    
    return (
      <div className="preferenze-overview">
        <div className="preferenze-header">
          <h3>Preferenze Ricevute - Settimana del {new Date(selectedWeek).toLocaleDateString('it-IT')}</h3>
          <p className="preferenze-subtitle">
            Visualizza le preferenze inviate dai dipendenti per facilitare la pianificazione
          </p>
        </div>

        <div className="preferenze-table-wrapper">
          <table className="preferenze-table">
            <thead>
              <tr>
                <th>Dipendente</th>
                {GIORNI.map((giorno, idx) => (
                  <th key={idx}>{giorno}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {utenti.map(utente => {
                const prefs = preferenzeUtenti[utente.id] || [];
                const prefByDay = {};
                prefs.forEach(p => {
                  prefByDay[p.giorno_settimana] = p.tipo_preferenza;
                });

                return (
                  <tr key={utente.id}>
                    <td className="dipendente-col">
                      <strong>{utente.nome}</strong>
                      <div className="dipendente-info">
                        {utente.ore_settimanali}h/sett
                        {utente.ha_chiavi && ' 🔑'}
                      </div>
                    </td>
                    {[0, 1, 2, 3, 4, 5, 6].map(giorno => (
                      <td key={giorno} className="preferenza-cell">
                        {prefByDay[giorno] ? (
                          <span className={`pref-badge pref-${prefByDay[giorno].toLowerCase()}`}>
                            {prefByDay[giorno]}
                          </span>
                        ) : (
                          <span className="pref-empty">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {utenti.length === 0 && (
          <div className="empty-state">
            Nessun dipendente trovato
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard Amministratore</h1>
          <p className="welcome-text">
            Benvenuto, <strong>{user?.nome}</strong>!
          </p>
          <div className="user-info">
            <span className="info-badge">👔 Amministratore</span>
            <span className="info-badge">📋 Pianificazione Turni</span>
          </div>
        </div>
        <div className="header-right">
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab ${viewMode === 'pianifica' ? 'active' : ''}`}
          onClick={() => setViewMode('pianifica')}
        >
          ✏️ Pianifica Turni
        </button>
        <button 
          className={`tab ${viewMode === 'preferenze' ? 'active' : ''}`}
          onClick={() => setViewMode('preferenze')}
        >
          📋 Visualizza Preferenze
        </button>
      </div>

      {/* Selettore Settimana */}
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

      {/* Contenuto */}
      <div className="dashboard-content">
        {viewMode === 'pianifica' && (
          <div className="pianifica-view">
            <div className="actions-bar">
              {!preferenzeImportate && (
                <button 
                  className="btn-action primary" 
                  onClick={handleImportaPreferenze}
                >
                  📥 Importa Preferenze
                </button>
              )}
              
              <button 
  className="btn-action primary" 
  onClick={handleAutoGenera}
  disabled={generandoPiano}
>
  {generandoPiano ? '⏳ Generazione...' : '🤖 Auto-Genera Settimana'}
</button>
              
              <button className="btn-action">
                📤 Pubblica Bozza
              </button>
              
              <button className="btn-action">
                ✅ Conferma Settimana
              </button>
              
              <button 
                className="btn-action btn-danger" 
                onClick={handleResetSettimana}
              >
                🗑️ Reset Settimana
              </button>
            </div>

            <div className="info-card">
              <h4>ℹ️ Istruzioni</h4>
              <p>
                <strong>1.</strong> Clicca "Importa Preferenze" per caricare le richieste dei dipendenti<br/>
                <strong>2.</strong> Usa "Auto-Genera" per completare automaticamente o inserisci turni manualmente<br/>
                <strong>3.</strong> Verifica le validazioni e correggi eventuali problemi<br/>
                <strong>4.</strong> Pubblica la bozza e poi conferma la settimana
              </p>
            </div>

            <ValidazioniPanel settimana={selectedWeek} onRefresh={refreshKey} />

            <WeekTable 
              key={refreshKey}
              settimana={selectedWeek} 
              editable={true}
              onTurnoClick={handleTurnoClick}
            />
          </div>
        )}

        {viewMode === 'preferenze' && renderPreferenzeGrid()}
      </div>

      {/* Modal Turno */}
      {modalOpen && selectedTurno && (
        <TurnoModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          onSave={handleTurnoSave}
          userId={selectedTurno.userId}
          userName={selectedTurno.userName}
          giorno={selectedTurno.giorno}
          settimana={selectedWeek}
          turnoEsistente={selectedTurno.turnoEsistente}
        />
      )}
    </div>
  );
};

export default DashboardAmministratore;