// Form per inserimento preferenze dipendente - CON SELEZIONE SETTIMANA
import React, { useState, useEffect } from 'react';
import { getPreferenze, savePreferenze, checkScadenzaPreferenze } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './PreferenzeForm.css';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const TIPI_PREFERENZA = ['OFF', 'APERTURA', 'CHIUSURA'];

const PreferenzeForm = () => {
  const { user } = useAuth();
  
  // Calcola settimane disponibili
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  currentMonday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const futureMonday = new Date(nextMonday);
  futureMonday.setDate(nextMonday.getDate() + 7);

  const future2Monday = new Date(futureMonday);
  future2Monday.setDate(futureMonday.getDate() + 7);

  const [settimanaSelezionata, setSettimanaSelezionata] = useState(nextMonday.toISOString().split('T')[0]);
  const [preferenze, setPreferenze] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [scadenzaInfo, setScadenzaInfo] = useState(null);

  useEffect(() => {
    loadPreferenze();
    checkScadenza();
  }, [settimanaSelezionata, user]);

  const loadPreferenze = async () => {
    if (!user) return;
    
    try {
      const response = await getPreferenze(user.id, settimanaSelezionata);
      
      // Converti array in oggetto { giorno: tipo }
      const prefObj = {};
      response.data.preferenze.forEach(pref => {
        // ✅ Escludi preferenze da ferie approvate (non modificabili)
        if (!pref.fonte || pref.fonte !== 'ferie_approvate') {
          prefObj[pref.giorno_settimana] = pref.tipo_preferenza;
        }
      });
      
      setPreferenze(prefObj);
    } catch (err) {
      console.error('Errore caricamento preferenze:', err);
    }
  };

  const checkScadenza = async () => {
    try {
      const response = await checkScadenzaPreferenze(settimanaSelezionata);
      setScadenzaInfo(response.data);
    } catch (err) {
      console.error('Errore check scadenza:', err);
      setScadenzaInfo(null);
    }
  };

  const handlePreferenzaChange = (giorno, tipo) => {
    setPreferenze(prev => {
      const newPref = { ...prev };
      
      // Se clicchi sulla stessa preferenza, la rimuovi
      if (newPref[giorno] === tipo) {
        delete newPref[giorno];
      } else {
        newPref[giorno] = tipo;
      }
      
      return newPref;
    });
    
    // Resetta messaggi
    setMessage(null);
    setError(null);
  };

  const validatePreferenze = () => {
    const prefArray = Object.entries(preferenze);
    
    // Conta tipi
    const offCount = prefArray.filter(([_, tipo]) => tipo === 'OFF').length;
    const altriCount = prefArray.filter(([_, tipo]) => tipo !== 'OFF').length;
    
    // Validazione: max 1 OFF + max 2 Apertura/Chiusura
    if (offCount > 1) {
      return 'Puoi selezionare massimo 1 giorno OFF';
    }
    
    if (altriCount > 2) {
      return 'Puoi selezionare massimo 2 preferenze tra Apertura e Chiusura';
    }
    
    if (offCount + altriCount > 3) {
      return 'Puoi selezionare massimo 3 preferenze in totale (1 OFF + 2 Apertura/Chiusura)';
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validazione
    const validationError = validatePreferenze();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Converti oggetto in array per API
      const prefArray = Object.entries(preferenze).map(([giorno, tipo]) => ({
        giorno_settimana: parseInt(giorno),
        tipo_preferenza: tipo
      }));
      
      await savePreferenze({
        user_id: user.id,
        settimana: settimanaSelezionata,
        preferenze: prefArray
      });
      
      setMessage('✅ Preferenze salvate con successo!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio preferenze:', err);
      setError(err.response?.data?.error || 'Errore nel salvataggio delle preferenze');
    } finally {
      setLoading(false);
    }
  };

  const contaPreferenze = () => {
    const prefArray = Object.entries(preferenze);
    const off = prefArray.filter(([_, tipo]) => tipo === 'OFF').length;
    const altri = prefArray.filter(([_, tipo]) => tipo !== 'OFF').length;
    return { off, altri };
  };

  const formatWeekRange = (mondayDate) => {
    const monday = new Date(mondayDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
  };

  const getWeekLabel = (mondayDate) => {
    const dateStr = new Date(mondayDate).toISOString().split('T')[0];
    if (dateStr === nextMonday.toISOString().split('T')[0]) return 'Prossima';
    if (dateStr === futureMonday.toISOString().split('T')[0]) return 'Tra 2 settimane';
    if (dateStr === future2Monday.toISOString().split('T')[0]) return 'Tra 3 settimane';
    return '';
  };

  const isScaduta = scadenzaInfo?.scaduta || false;
  const counts = contaPreferenze();

  // ✅ Se scaduta SOLO per settimana prossima, blocca
  if (isScaduta) {
    return (
      <div className="preferenze-form-container">
        <div className="preferenze-header" style={{ background: '#f8d7da', padding: '30px', borderRadius: '8px' }}>
          <h3 style={{ color: '#721c24' }}>🔒 Scadenza Superata per la Settimana Prossima</h3>
          <p className="preferenze-info" style={{ color: '#721c24' }}>
            Le preferenze per la <strong>settimana prossima</strong> non sono più modificabili.<br/>
            La scadenza era <strong>mercoledì alle 21:59</strong>.<br/><br/>
            Puoi comunque inserire preferenze per le settimane successive selezionando un'altra settimana sopra.
          </p>
        </div>

        {/* Tab Selezione Settimana anche quando scaduta */}
        <div className="settimane-tabs" style={{ marginTop: '20px' }}>
          <button 
            className={`settimana-tab ${settimanaSelezionata === nextMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSettimanaSelezionata(nextMonday.toISOString().split('T')[0])}
            disabled={scadenzaInfo?.scaduta && settimanaSelezionata === nextMonday.toISOString().split('T')[0]}
          >
            {formatWeekRange(nextMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Prossima) 🔒</span>
          </button>
          <button 
            className={`settimana-tab ${settimanaSelezionata === futureMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSettimanaSelezionata(futureMonday.toISOString().split('T')[0])}
          >
            {formatWeekRange(futureMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Tra 2 settimane)</span>
          </button>
          <button 
            className={`settimana-tab ${settimanaSelezionata === future2Monday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSettimanaSelezionata(future2Monday.toISOString().split('T')[0])}
          >
            {formatWeekRange(future2Monday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Tra 3 settimane)</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="preferenze-form-container">
      <div className="preferenze-header">
        <h3>Inserisci le tue preferenze</h3>
        <p className="preferenze-info">
          Seleziona la settimana e indica <strong>1 giorno OFF</strong> e <strong>2 giorni</strong> in cui preferisci 
          fare <strong>Apertura o Chiusura</strong>
        </p>
      </div>

      {/* Tab Selezione Settimana */}
      <div className="settimane-tabs">
        <button 
          className={`settimana-tab ${settimanaSelezionata === nextMonday.toISOString().split('T')[0] ? 'active' : ''}`}
          onClick={() => setSettimanaSelezionata(nextMonday.toISOString().split('T')[0])}
        >
          {formatWeekRange(nextMonday)}<br/>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>(Prossima)</span>
        </button>
        <button 
          className={`settimana-tab ${settimanaSelezionata === futureMonday.toISOString().split('T')[0] ? 'active' : ''}`}
          onClick={() => setSettimanaSelezionata(futureMonday.toISOString().split('T')[0])}
        >
          {formatWeekRange(futureMonday)}<br/>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>(Tra 2 settimane)</span>
        </button>
        <button 
          className={`settimana-tab ${settimanaSelezionata === future2Monday.toISOString().split('T')[0] ? 'active' : ''}`}
          onClick={() => setSettimanaSelezionata(future2Monday.toISOString().split('T')[0])}
        >
          {formatWeekRange(future2Monday)}<br/>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>(Tra 3 settimane)</span>
        </button>
      </div>

      {/* Warning Scadenza Imminente */}
      {settimanaSelezionata === nextMonday.toISOString().split('T')[0] && scadenzaInfo && !scadenzaInfo.scaduta && (
        <div className="info-card info-warning">
          <h4>⚠️ Scadenza imminente</h4>
          <p>
            Le preferenze per questa settimana devono essere inserite entro 
            <strong> mercoledì alle 21:59</strong>. Dopo non sarà più possibile modificarle.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="preferenze-grid">
          {GIORNI.map((nomeGiorno, idx) => (
            <div key={idx} className="giorno-preferenze">
              <div className="giorno-nome">{nomeGiorno}</div>
              <div className="giorno-data">
                {new Date(new Date(settimanaSelezionata).getTime() + idx * 86400000)
                  .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
              </div>
              
              <div className="preferenze-buttons">
                {TIPI_PREFERENZA.map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    className={`pref-btn pref-${tipo.toLowerCase()} ${
                      preferenze[idx] === tipo ? 'active' : ''
                    }`}
                    onClick={() => handlePreferenzaChange(idx, tipo)}
                    disabled={loading}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="preferenze-summary">
          <div className="summary-item">
            <span className="summary-label">OFF selezionati:</span>
            <span className={`summary-value ${counts.off > 1 ? 'error' : ''}`}>
              {counts.off} / 1
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Apertura/Chiusura selezionati:</span>
            <span className={`summary-value ${counts.altri > 2 ? 'error' : ''}`}>
              {counts.altri} / 2
            </span>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="preferenze-actions">
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => setPreferenze({})}
            disabled={loading}
          >
            Pulisci Tutto
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={loading || Object.keys(preferenze).length === 0}
          >
            {loading ? 'Salvataggio...' : 'Salva Preferenze'}
          </button>
        </div>
      </form>

      <div className="preferenze-help">
        <strong>💡 Come funziona:</strong>
        <ul>
          <li><strong>Seleziona la settimana</strong> per cui vuoi inviare le preferenze</li>
          <li><strong>Clicca</strong> sui bottoni per selezionare le preferenze (OFF, APERTURA, CHIUSURA)</li>
          <li><strong>Clicca di nuovo</strong> per deselezionare</li>
          <li>Solo la <strong>settimana prossima</strong> ha scadenza mercoledì 21:59</li>
          <li>Le altre settimane possono essere modificate liberamente</li>
          <li>Le preferenze aiutano l'amministratore nella pianificazione ma non sono vincolanti</li>
        </ul>
      </div>
    </div>
  );
};

export default PreferenzeForm;