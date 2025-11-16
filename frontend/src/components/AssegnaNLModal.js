// Modal per assegnare ore NL (Non Lavorato) a un dipendente
import React, { useState, useEffect } from 'react';
import { assegnaOreNL, getOreNL } from '../api/axios';
import './AssegnaNLModal.css';

const AssegnaNLModal = ({ isOpen, onClose, onSave, userId, userName, settimana }) => {
  const [oreNL, setOreNL] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nlEsistente, setNlEsistente] = useState(null);

  useEffect(() => {
    if (isOpen && userId && settimana) {
      loadNLEsistente();
    }
  }, [isOpen, userId, settimana]);

  const loadNLEsistente = async () => {
    try {
      const response = await getOreNL(userId, settimana);
      if (response.data.ore_nl) {
        setNlEsistente(response.data.ore_nl);
        setOreNL(parseFloat(response.data.ore_nl.ore_nl));
        setMotivo(response.data.ore_nl.motivo || '');
      } else {
        setNlEsistente(null);
        setOreNL(0);
        setMotivo('');
      }
    } catch (err) {
      console.log('Nessun NL esistente per questa settimana');
      setNlEsistente(null);
      setOreNL(0);
      setMotivo('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (oreNL <= 0) {
      setError('Inserisci un numero di ore maggiore di 0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await assegnaOreNL({
        user_id: userId,
        settimana: settimana,
        ore_nl: oreNL,
        motivo: motivo.trim() || null
      });

      onSave && onSave();
      onClose();
    } catch (err) {
      console.error('Errore assegnazione NL:', err);
      setError(err.response?.data?.error || 'Errore nell\'assegnazione delle ore NL');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!nlEsistente) return;
    
    if (!window.confirm('Sei sicuro di voler rimuovere le ore NL assegnate?')) {
      return;
    }

    try {
      setLoading(true);
      // Implementa l'API per eliminare
      await assegnaOreNL({
        user_id: userId,
        settimana: settimana,
        ore_nl: 0, // 0 = rimuovi
        motivo: null
      });

      onSave && onSave();
      onClose();
    } catch (err) {
      setError('Errore nella rimozione delle ore NL');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="nl-modal-overlay" onClick={onClose}>
      <div className="nl-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="nl-modal-header">
          <h3>Assegna Ore NL (Non Lavorato)</h3>
          <button className="nl-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="nl-modal-body">
          <div className="nl-info-section">
            <div className="nl-info-item">
              <strong>Dipendente:</strong> {userName}
            </div>
            <div className="nl-info-item">
              <strong>Settimana:</strong> {new Date(settimana).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </div>
            {nlEsistente && (
              <div className="nl-info-item" style={{ color: '#17a2b8', fontWeight: 'bold' }}>
                ⚠️ Ci sono già {nlEsistente.ore_nl}h NL assegnate per questa settimana
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                Ore NL da assegnare *
              </label>
              <input
                type="number"
                className="form-control"
                value={oreNL}
                onChange={(e) => setOreNL(parseFloat(e.target.value) || 0)}
                min="0"
                max="40"
                step="0.5"
                placeholder="es. 4.5"
                disabled={loading}
                autoFocus
              />
              <small className="form-help">
                Queste ore verranno sottratte dalle "ore da recuperare" cumulative del dipendente
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                Motivo (facoltativo)
              </label>
              <textarea
                className="form-control"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows="3"
                placeholder="es. Recupero straordinari, Chiusura negozio, ecc."
                disabled={loading}
              />
            </div>

            {oreNL > 0 && (
              <div className="nl-preview">
                <strong>Riepilogo:</strong><br />
                Verranno assegnate <strong>{oreNL}h</strong> di Non Lavorato a <strong>{userName}</strong> per la settimana selezionata.
                Queste ore saranno visibili a tutti i dipendenti nella tabella turni.
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="nl-modal-footer">
              {nlEsistente && (
                <button 
                  type="button"
                  className="btn-nl-delete" 
                  onClick={handleDelete}
                  disabled={loading}
                >
                  🗑️ Rimuovi NL
                </button>
              )}
              <div className="nl-modal-actions">
                <button 
                  type="button"
                  className="btn-nl-cancel" 
                  onClick={onClose}
                  disabled={loading}
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="btn-nl-save"
                  disabled={loading || oreNL <= 0}
                >
                  {loading ? 'Salvataggio...' : (nlEsistente ? 'Aggiorna' : 'Assegna')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssegnaNLModal;