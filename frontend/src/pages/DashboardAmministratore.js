// Dashboard Amministratore - Con workflow autorizzazione
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllUsers, 
  getPreferenze,
  getTutteRichiesteFerie,
  generaPianificazioneAutomatica,
  importaPreferenze,
  resetSettimana,
  getConfigPresidio,
  getStatoSettimana,
  pubblicaBozza,
  confermaSettimana,
  downloadExcelSettimana
} from '../api/axios';
import WeekTable from '../components/WeekTable';
import TurnoModal from '../components/TurnoModal';
import ValidazioniPanel from '../components/ValidazioniPanel';
import StoricoPanel from '../components/StoricoPanel';
import RichiesteFeriePanel from '../components/RichiesteFeriePanel';
import StatoSettimanaBar from '../components/StatoSettimanaBar';
import './Dashboard.css';
import './DashboardAmministratore.css';

const DashboardAmministratore = () => {
  const { user, logout } = useAuth();
  
  // Calcola settimane
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  currentMonday.setHours(0, 0, 0, 0);

  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 7);

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const futureMonday = new Date(nextMonday);
  futureMonday.setDate(nextMonday.getDate() + 7);
  
  const [selectedWeek, setSelectedWeek] = useState(nextMonday.toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('pianifica');
  const [utenti, setUtenti] = useState([]);
  const [preferenzeUtenti, setPreferenzeUtenti] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [preferenzeImportate, setPreferenzeImportate] = useState(false);
  const [generandoPiano, setGenerandoPiano] = useState(false);
  const [configPresidio, setConfigPresidio] = useState({});
  const [richiesteInAttesa, setRichiesteInAttesa] = useState(0);
  const [statoSettimana, setStatoSettimana] = useState(null);
  const [warningScadenza, setWarningScadenza] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  
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
    loadStatoSettimana();
  }, [selectedWeek]);

  useEffect(() => {
    loadRichiesteCount();
  }, []);

  const loadStatoSettimana = async () => {
    try {
      const response = await getStatoSettimana(selectedWeek);
      setStatoSettimana(response.data);
    } catch (err) {
      console.error('Errore caricamento stato:', err);
    }
  };

  const loadRichiesteCount = async () => {
    try {
      const response = await getTutteRichiesteFerie({ stato: 'in_attesa' });
      setRichiesteInAttesa(response.data.in_attesa_count);
    } catch (err) {
      console.error('Errore conteggio richieste:', err);
    }
  };

  const loadUtenti = async () => {
    try {
      const response = await getAllUsers();
      const utentiFiltrati = response.data.users.filter(u => u.ruolo !== 'manager');
      setUtenti(utentiFiltrati);
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

  const handlePresidioUpdate = async (giorno, nuovoTipo) => {
    const nuovoConfig = { ...configPresidio, [giorno]: nuovoTipo };
    setConfigPresidio(nuovoConfig);
    
    setTimeout(() => {
      setRefreshKey(prev => prev + 1);
    }, 100);
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
      
      const { turniGenerati, giorniVerdi, tentativiEffettuati } = response.data;
      
      const messaggioSuccesso = `✅ Pianificazione generata!\n\n` +
        `📊 ${turniGenerati} turni creati\n` +
        `🟢 ${giorniVerdi}/7 giorni con presidio valido\n` +
        `🔄 ${tentativiEffettuati} tentativi effettuati`;
      
      alert(messaggioSuccesso);
      
      setRefreshKey(prev => prev + 1);
      
    } catch (err) {
      console.error('Errore generazione:', err);
      const messaggioErrore = err.response?.data?.error || err.message;
      alert('❌ Errore nella generazione automatica:\n\n' + messaggioErrore);
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
      loadStatoSettimana();
    } catch (err) {
      alert('❌ Errore reset: ' + err.message);
    }
  };

  const handlePubblicaBozza = async () => {
  if (!window.confirm('Pubblicare la bozza?\n\nLa settimana diventerà visibile ai dipendenti.')) {
    return;
  }

  try {
    const response = await pubblicaBozza(selectedWeek);
    alert('✅ ' + response.data.message);
    
    // ✅ AGGIUNGI QUESTI REFRESH
    await loadStatoSettimana();
    setRefreshKey(prev => prev + 1);
    
  } catch (err) {
    alert('❌ Errore: ' + (err.response?.data?.error || err.message));
  }
};

  const handleConfermaSettimana = async () => {
  if (!window.confirm('Confermare la settimana?\n\nVerrà inoltrata al manager per autorizzazione.')) {
    return;
  }

  try {
    const response = await confermaSettimana(selectedWeek);
    
    let messaggio = '✅ ' + response.data.message;
    if (response.data.warning) {
      messaggio += '\n\n⚠️ ' + response.data.warning;
    }
    
    alert(messaggio);
    setWarningScadenza(response.data.warning);
    
    // ✅ AGGIUNGI QUESTI REFRESH
    await loadStatoSettimana();
    setRefreshKey(prev => prev + 1);
    
  } catch (err) {
    alert('❌ Errore: ' + (err.response?.data?.error || err.message));
  }
};

const handleDownloadExcel = async () => {
  try {
    setDownloadingExcel(true);
    const result = await downloadExcelSettimana(selectedWeek);
    
    if (!result.success) {
      alert('❌ Errore nel download: ' + result.error);
    }
    // Il file viene scaricato automaticamente dal browser
    
  } catch (err) {
    console.error('Errore download:', err);
    alert('❌ Errore nel download del file Excel');
  } finally {
    setDownloadingExcel(false);
  }
};

  const formatWeekRange = (mondayDate) => {
    const monday = new Date(mondayDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
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
                    {[0, 1, 2, 3, 4, 5, 6].map(giorno => {
                      const pref = prefs.find(p => p.giorno_settimana === giorno);
                      const isDaFerie = pref?.fonte === 'ferie_approvate';
                      
                      return (
                        <td key={giorno} className="preferenza-cell">
                          {pref ? (
                            <span 
                              className={`pref-badge pref-${pref.tipo_preferenza.toLowerCase()}`}
                              style={isDaFerie ? {
                                border: '2px solid #667eea',
                                boxShadow: '0 0 8px rgba(102, 126, 234, 0.4)',
                                position: 'relative'
                              } : {}}
                              title={isDaFerie ? `${pref.tipo_preferenza} da richiesta ferie approvata` : ''}
                            >
                              {isDaFerie && <span style={{ marginRight: '4px' }}>🏖️</span>}
                              {pref.tipo_preferenza}
                            </span>
                          ) : (
                            <span className="pref-empty">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px 20px',
          background: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#666'
        }}>
          <strong>Legenda:</strong> I badge con 🏖️ provengono da richieste ferie approvate e verranno importate automaticamente.
        </div>

        {utenti.length === 0 && (
          <div className="empty-state">
            Nessun dipendente trovato
          </div>
        )}
      </div>
    );
  };

  const canModifyWeek = () => {
    // Admin può sempre modificare
    return true;
  };

  const getActionButtons = () => {
    if (!statoSettimana) return null;

    const stato = statoSettimana.stato;

    return (
      <div className="actions-bar">
        {/* IMPORTA PREFERENZE - sempre disponibile in pianificazione */}
        {stato === 'pianificazione' && !preferenzeImportate && (
          <button 
            className="btn-action primary" 
            onClick={handleImportaPreferenze}
          >
            📥 Importa Preferenze
          </button>
        )}
        
        {/* AUTO-GENERA - disponibile in pianificazione e bozza */}
        {(stato === 'pianificazione' || stato === 'bozza' || stato === 'rifiutata') && (
          <button 
            className="btn-action primary" 
            onClick={handleAutoGenera}
            disabled={generandoPiano}
          >
            {generandoPiano ? '⏳ Generazione...' : '🤖 Auto-Genera Settimana'}
          </button>
        )}
        
        {/* PUBBLICA BOZZA - solo da pianificazione */}
        {stato === 'pianificazione' && (
          <button 
            className="btn-action primary" 
            onClick={handlePubblicaBozza}
          >
            📤 Pubblica Bozza
          </button>
        )}
        
        {/* CONFERMA SETTIMANA - da bozza o rifiutata */}
        {(stato === 'bozza' || stato === 'rifiutata') && (
          <button 
            className="btn-action primary" 
            onClick={handleConfermaSettimana}
          >
            ✅ Conferma Settimana
          </button>
        )}
        
        {/* RESET - sempre disponibile tranne autorizzata */}
        {stato !== 'autorizzata' && stato !== 'confermata' && (
          <button 
            className="btn-action btn-danger" 
            onClick={handleResetSettimana}
          >
            🗑️ Reset Settimana
          </button>
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
        <button 
          className={`tab ${viewMode === 'ferie' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('ferie');
            loadRichiesteCount();
          }}
          style={{ position: 'relative' }}
        >
          🏖️ Richieste Ferie
          {richiesteInAttesa > 0 && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '700',
              boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4)',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              {richiesteInAttesa}
            </span>
          )}
        </button>
        <button 
          className={`tab ${viewMode === 'storico' ? 'active' : ''}`}
          onClick={() => setViewMode('storico')}
        >
          📊 Storico Contatori
        </button>
      </div>

      {/* Selettore Settimana */}
      {viewMode !== 'storico' && (
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
      )}

      {/* Contenuto */}
      <div className="dashboard-content">
        {viewMode === 'pianifica' && (
          <div className="pianifica-view">
            {/* Barra Stato */}
            <StatoSettimanaBar 
              settimana={selectedWeek} 
              onUpdate={() => {
                loadStatoSettimana();
                setRefreshKey(prev => prev + 1);
              }} 
            />

            {/* Warning Scadenza */}
            {warningScadenza && (
              <div className="info-card" style={{ background: '#fff3cd', borderLeft: '4px solid #ffc107' }}>
                <h4 style={{ color: '#856404' }}>⚠️ {warningScadenza}</h4>
              </div>
            )}

            {/* Azioni Workflow */}
            {getActionButtons()}

{/* Bottone Download Excel */}
<div style={{ 
  marginTop: '20px', 
  paddingTop: '20px', 
  borderTop: '2px solid #e0e0e0',
  display: 'flex',
  justifyContent: 'center'
}}>
  <button 
    className="btn-action primary"
    onClick={handleDownloadExcel}
    disabled={downloadingExcel}
    style={{
      minWidth: '250px',
      fontSize: '16px',
      padding: '15px 30px'
    }}
  >
    {downloadingExcel ? '⏳ Generazione Excel...' : '📥 Scarica Excel Settimana'}
  </button>
</div>

            {statoSettimana?.stato === 'rifiutata' && statoSettimana.note_rifiuto && (
              <div className="info-card" style={{ background: '#f8d7da', borderLeft: '4px solid #dc3545' }}>
                <h4 style={{ color: '#721c24' }}>🔴 Pianificazione Rifiutata dal Manager</h4>
                <p style={{ color: '#721c24' }}>
                  <strong>Motivo:</strong> {statoSettimana.note_rifiuto}
                </p>
              </div>
            )}

            <div className="info-card">
              <h4>ℹ️ Workflow Autorizzazione</h4>
              <p>
                <strong>1. Pianificazione:</strong> Inserisci preferenze e genera la settimana<br/>
                <strong>2. Pubblica Bozza:</strong> Rendi visibile ai dipendenti<br/>
                <strong>3. Conferma Settimana:</strong> Inoltra al manager (entro sabato 19:59)<br/>
                <strong>4. Autorizzazione Manager:</strong> Attendi l'approvazione finale
              </p>
            </div>

            <ValidazioniPanel 
              settimana={selectedWeek} 
              onRefresh={refreshKey}
              configPresidio={configPresidio}
            />

            <WeekTable 
              key={`${refreshKey}-${JSON.stringify(configPresidio)}`}
              settimana={selectedWeek} 
              editable={canModifyWeek()}
              onTurnoClick={handleTurnoClick}
              onPresidioChange={handlePresidioUpdate}
              configPresidio={configPresidio}
            />
          </div>
        )}

        {viewMode === 'preferenze' && renderPreferenzeGrid()}

        {viewMode === 'storico' && <StoricoPanel />}
        
        {viewMode === 'ferie' && (
          <RichiesteFeriePanel 
            onUpdate={loadRichiesteCount}
          />
        )}
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

      {/* Overlay Generazione */}
      {generandoPiano && (
        <div className="generating-overlay">
          <div className="generating-content">
            <div className="generating-spinner"></div>
            <h3>🤖 Generazione in corso...</h3>
            <p>
              L'algoritmo sta elaborando la pianificazione ottimale.<br />
              Questo potrebbe richiedere alcuni secondi.
            </p>
            <div className="generating-progress">
              Analizzando 20000 configurazioni possibili...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAmministratore;