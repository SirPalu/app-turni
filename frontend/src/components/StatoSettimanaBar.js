// Componente Barra Stato Settimana
import React, { useState, useEffect } from 'react';
import { getStatoSettimana } from '../api/axios';
import './StatoSettimanaBar.css';

const STATI_LABELS = {
  pianificazione: {
    icon: '📝',
    label: 'In Pianificazione',
    descrizione: 'Visibile solo agli amministratori'
  },
  bozza: {
    icon: '📋',
    label: 'Bozza Pubblicata',
    descrizione: 'Visibile ai dipendenti'
  },
  confermata: {
    icon: '✅',
    label: 'Confermata',
    descrizione: 'In attesa di autorizzazione manager'
  },
  autorizzata: {
    icon: '🟢',
    label: 'Autorizzata',
    descrizione: 'Settimana approvata dal manager'
  },
  rifiutata: {
    icon: '🔴',
    label: 'Rifiutata',
    descrizione: 'Richiede modifiche'
  }
};

const StatoSettimanaBar = ({ settimana, onUpdate }) => {
  const [stato, setStato] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStato();
  }, [settimana, onUpdate]);

  const loadStato = async () => {
    try {
      setLoading(true);
      const response = await getStatoSettimana(settimana);
      setStato(response.data);
    } catch (err) {
      console.error('Errore caricamento stato:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Caricamento stato...</div>;
  }

  if (!stato) return null;

  const statoInfo = STATI_LABELS[stato.stato] || STATI_LABELS.pianificazione;

  return (
    <div className="stato-settimana-bar">
      <div className="stato-content">
        <div className="stato-info">
          <div className="stato-label">Stato Settimana</div>
          <div className="stato-value">
            <span className={`stato-badge ${stato.stato}`}>
              <span>{statoInfo.icon}</span>
              <span>{statoInfo.label}</span>
            </span>
            <span style={{ color: '#666', fontSize: '14px' }}>
              {statoInfo.descrizione}
            </span>
          </div>

          {stato.pubblicata_il && (
            <div className="stato-timestamp">
              Pubblicata: {formatTimestamp(stato.pubblicata_il)}
              {stato.pubblicata_da_nome && ` da ${stato.pubblicata_da_nome}`}
            </div>
          )}

          {stato.confermata_il && (
            <div className="stato-timestamp">
              Confermata: {formatTimestamp(stato.confermata_il)}
              {stato.confermata_da_nome && ` da ${stato.confermata_da_nome}`}
            </div>
          )}

          {stato.autorizzata_il && (
            <div className="stato-timestamp">
              Autorizzata: {formatTimestamp(stato.autorizzata_il)}
              {stato.autorizzata_da_nome && ` da ${stato.autorizzata_da_nome}`}
            </div>
          )}

          {stato.rifiutata_il && (
            <div className="stato-timestamp">
              Rifiutata: {formatTimestamp(stato.rifiutata_il)}
              {stato.rifiutata_da_nome && ` da ${stato.rifiutata_da_nome}`}
            </div>
          )}
        </div>
      </div>

      {stato.note_rifiuto && (
        <div className="note-rifiuto-box">
          <strong>📝 Note Manager:</strong>
          <p>{stato.note_rifiuto}</p>
        </div>
      )}
    </div>
  );
};

export default StatoSettimanaBar;