// Form per inserimento preferenze dipendente
import React, { useState, useEffect } from 'react';
import { getPreferenze, savePreferenze } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './PreferenzeForm.css';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const TIPI_PREFERENZA = ['OFF', 'APERTURA', 'CHIUSURA'];

const PreferenzeForm = ({ settimana }) => {
  const { user } = useAuth();
  const [preferenze, setPreferenze] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPreferenze();
  }, [settimana, user]);

  const loadPreferenze = async () => {
    if (!user) return;
    
    try {
      const response = await getPreferenze(user.id, settimana);
      
      // Converti array in oggetto { giorno: tipo }
      const prefObj = {};
      response.data.preferenze.forEach(pref => {
        prefObj[pref.giorno_settimana] = pref.tipo_preferenza;
      });
      
      setPreferenze(prefObj);
    } catch (err) {
      console.error('Errore caricamento preferenze:', err);
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
        settimana: settimana,
        preferenze: prefArray
      });
      
      setMessage('Preferenze salvate con successo! ✓');
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

  const counts = contaPreferenze();

  return (
    <div className="preferenze-form-container">
      <div className="preferenze-header">
        <h3>Inserisci le tue preferenze</h3>
        <p className="preferenze-info">
          Seleziona <strong>1 giorno OFF</strong> e <strong>2 giorni</strong> in cui preferisci 
          fare <strong>Apertura o Chiusura</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="preferenze-grid">
          {GIORNI.map((nomeGiorno, idx) => (
            <div key={idx} className="giorno-preferenze">
              <div className="giorno-nome">{nomeGiorno}</div>
              <div className="giorno-data">
                {new Date(new Date(settimana).getTime() + idx * 86400000)
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
          <li>Clicca su un bottone per selezionare la preferenza</li>
          <li>Clicca di nuovo per deselezionare</li>
          <li>Le preferenze non sono vincolanti, ma aiutano l'amministratore nella pianificazione</li>
        </ul>
      </div>
    </div>
  );
};

export default PreferenzeForm;