// Componente Calendario Ferie per Dipendente
import React, { useState, useEffect } from 'react';
import { creaRichiestaFerie, getRichiesteDipendente, eliminaRichiesta } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './CalendarioFerie.css';

const GIORNI_SETTIMANA = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
              'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const CalendarioFerie = () => {
  const { user } = useAuth();
  const [meseCorrente, setMeseCorrente] = useState(new Date());
  const [giorniSelezionati, setGiorniSelezionati] = useState([]);
  const [richieste, setRichieste] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRichieste();
  }, [meseCorrente]);

  const loadRichieste = async () => {
    if (!user) return;
    
    try {
      const response = await getRichiesteDipendente(user.id);
      setRichieste(response.data.richieste);
    } catch (err) {
      console.error('Errore caricamento richieste:', err);
    }
  };

  const cambiaMese = (direzione) => {
    const nuovaData = new Date(meseCorrente);
    nuovaData.setMonth(meseCorrente.getMonth() + direzione);
    
    // Limita a 6 mesi nel futuro
    const oggi = new Date();
    const seiMesiDopo = new Date(oggi);
    seiMesiDopo.setMonth(oggi.getMonth() + 6);
    
    if (nuovaData <= seiMesiDopo && nuovaData >= oggi) {
      setMeseCorrente(nuovaData);
      setGiorniSelezionati([]); // Reset selezione
    }
  };

  const generaGiorniMese = () => {
    const anno = meseCorrente.getFullYear();
    const mese = meseCorrente.getMonth();
    
    const primoGiorno = new Date(anno, mese, 1);
    const ultimoGiorno = new Date(anno, mese + 1, 0);
    
    const giorni = [];
    
    // Celle vuote prima del primo giorno
    for (let i = 0; i < primoGiorno.getDay(); i++) {
      giorni.push(null);
    }
    
    // Giorni del mese
    for (let giorno = 1; giorno <= ultimoGiorno.getDate(); giorno++) {
      giorni.push(new Date(anno, mese, giorno));
    }
    
    return giorni;
  };

  const isGiornoSelezionabile = (data) => {
    if (!data) return false;
    
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const domani = new Date(oggi);
    domani.setDate(oggi.getDate() + 1);
    
    const seiMesiDopo = new Date(domani);
    seiMesiDopo.setMonth(domani.getMonth() + 6);
    
    return data >= domani && data <= seiMesiDopo;
  };

  const getRichiestaPerGiorno = (data) => {
    if (!data) return null;
    const dataStr = data.toISOString().split('T')[0];
    return richieste.find(r => r.data_richiesta === dataStr);
  };

  const toggleGiorno = (data) => {
    if (!data || !isGiornoSelezionabile(data)) return;
    
    // Verifica se c'è già una richiesta per questo giorno
    const richiestaEsistente = getRichiestaPerGiorno(data);
    if (richiestaEsistente) {
      if (richiestaEsistente.tipo_approvazione === 'in_attesa') {
        // Permetti di deselezionare solo se in attesa
        handleEliminaRichiesta(richiestaEsistente.id);
      }
      return;
    }
    
    const dataStr = data.toISOString().split('T')[0];
    
    if (giorniSelezionati.includes(dataStr)) {
      setGiorniSelezionati(giorniSelezionati.filter(d => d !== dataStr));
    } else {
      setGiorniSelezionati([...giorniSelezionati, dataStr]);
    }
  };

  const handleInviaRichiesta = async () => {
    if (giorniSelezionati.length === 0) {
      setError('Seleziona almeno un giorno');
      return;
    }

    if (!window.confirm(`Inviare richiesta ferie per ${giorniSelezionati.length} giorno/i?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await creaRichiestaFerie({
        user_id: user.id,
        date: giorniSelezionati
      });
      
      setMessage(`✅ Richiesta inviata per ${giorniSelezionati.length} giorno/i`);
setGiorniSelezionati([]);
await loadRichieste(); // ✅ Aggiungi await
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Errore invio richiesta:', err);
      setError(err.response?.data?.error || 'Errore nell\'invio della richiesta');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminaRichiesta = async (richiestaId) => {
    if (!window.confirm('Eliminare questa richiesta?')) {
      return;
    }

    try {
      await eliminaRichiesta(richiestaId);
      setMessage('✅ Richiesta eliminata');
      loadRichieste();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Errore eliminazione:', err);
      setError('Errore nell\'eliminazione della richiesta');
    }
  };

  const getClasseGiorno = (data) => {
    if (!data) return 'disabled';
    
    const richiesta = getRichiestaPerGiorno(data);
    if (richiesta) {
      return richiesta.tipo_approvazione; // in_attesa, approvata, rifiutata, off_approvato
    }
    
    const dataStr = data.toISOString().split('T')[0];
    if (giorniSelezionati.includes(dataStr)) {
      return 'selected';
    }
    
    if (!isGiornoSelezionabile(data)) {
      return 'passato';
    }
    
    return '';
  };

  const getLabelStato = (stato) => {
    const labels = {
      in_attesa: 'In attesa',
      approvata: 'Approvata',
      rifiutata: 'Rifiutata',
      off_approvato: 'OFF'
    };
    return labels[stato] || '';
  };

  const giorni = generaGiorniMese();

  return (
    <div className="calendario-ferie-container">
      <div className="info-box">
        <h4>ℹ️ Come funziona</h4>
        <ul>
          <li><strong>Clicca</strong> sui giorni per selezionarli (puoi selezionare singoli giorni o periodi)</li>
          <li>Puoi richiedere ferie da <strong>domani</strong> fino a <strong>6 mesi</strong> nel futuro</li>
          <li>Le richieste in attesa possono essere eliminate cliccandoci sopra</li>
          <li>Riceverai notifica quando l'admin approva/rifiuta la richiesta</li>
        </ul>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="calendario-header">
        <div className="mese-selector">
          <button className="btn-mese" onClick={() => cambiaMese(-1)}>◀</button>
          <div className="mese-corrente">
            {MESI[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}
          </div>
          <button className="btn-mese" onClick={() => cambiaMese(1)}>▶</button>
        </div>
      </div>

      <div className={`selezione-info ${giorniSelezionati.length > 0 ? 'has-selection' : ''}`}>
        <div className="selezione-count">
          {giorniSelezionati.length > 0 
            ? `${giorniSelezionati.length} giorno/i selezionato/i` 
            : 'Nessun giorno selezionato'}
        </div>
        {giorniSelezionati.length > 0 && (
          <>
            <button className="btn-clear-selection" onClick={() => setGiorniSelezionati([])}>
              ✖ Cancella selezione
            </button>
            <button 
              className="btn-invia-richiesta" 
              onClick={handleInviaRichiesta}
              disabled={loading}
            >
              {loading ? '⏳ Invio...' : '✉️ Invia Richiesta'}
            </button>
          </>
        )}
      </div>

      <div className="calendario-grid">
        {GIORNI_SETTIMANA.map((giorno, idx) => (
          <div key={idx} className="giorno-header">{giorno}</div>
        ))}
        
        {giorni.map((data, idx) => {
          const richiesta = data ? getRichiestaPerGiorno(data) : null;
          const classe = getClasseGiorno(data);
          
          return (
            <div
              key={idx}
              className={`giorno-cell ${classe}`}
              onClick={() => toggleGiorno(data)}
              title={richiesta?.note_admin || ''}
            >
              {data && (
                <>
                  <div className="giorno-numero">{data.getDate()}</div>
                  {richiesta && (
                    <div className="giorno-stato">
                      {getLabelStato(richiesta.tipo_approvazione)}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="legenda-container">
        <strong style={{ width: '100%', marginBottom: '10px' }}>Legenda:</strong>
        <div className="legenda-item">
          <div className="legenda-box" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderColor: '#667eea' }}></div>
          <span>Selezionato</span>
        </div>
        <div className="legenda-item">
          <div className="legenda-box" style={{ background: '#fff3cd', borderColor: '#ffc107' }}></div>
          <span>In attesa approvazione</span>
        </div>
        <div className="legenda-item">
          <div className="legenda-box" style={{ background: '#d4edda', borderColor: '#28a745' }}></div>
          <span>Ferie approvata</span>
        </div>
        <div className="legenda-item">
          <div className="legenda-box" style={{ background: '#d1ecf1', borderColor: '#17a2b8' }}></div>
          <span>OFF approvato</span>
        </div>
        <div className="legenda-item">
          <div className="legenda-box" style={{ background: '#f8d7da', borderColor: '#dc3545' }}></div>
          <span>Rifiutata</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarioFerie;