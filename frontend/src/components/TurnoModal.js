// Modal per inserimento/modifica turno - CON ORARI MODULARI
import React, { useState, useEffect } from 'react';
import { createOrUpdateTurno, deleteTurno, getUserById } from '../api/axios';
import './TurnoModal.css';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const TIPI_TURNO = ['APERTURA', 'CENTRALE-A', 'CENTRALE-B', 'CENTRALE', 'CHIUSURA', 'FERIE', 'MALATTIA'];

// Calcola ore giornaliere in base a contratto
const calcolaOreGiornaliere = (oreSettimanali) => {
  const oreGiorno = oreSettimanali / 5;
  if (oreGiorno >= 7.5) return 8;
  if (oreGiorno >= 6.5) return 7;
  if (oreGiorno >= 5.5) return 6;
  return 5;
};

// Orari predefiniti modulari
const getOrariPredefiniti = (tipoTurno, oreGiorno) => {
  const orari = {
    APERTURA: {
      5: { inizio: '09:30', fine: '14:30' },
      6: { inizio: '09:30', fine: '15:30' },
      7: { inizio: '09:30', fine: '16:30' },
      8: { inizio: '09:30', fine: '17:30' }
    },
    'CENTRALE-A': {
      5: { inizio: '12:00', fine: '17:00' },
      6: { inizio: '12:00', fine: '18:00' },
      7: { inizio: '12:00', fine: '19:00' },
      8: { inizio: '11:00', fine: '19:00' }
    },
    'CENTRALE-B': {
      5: { inizio: '14:00', fine: '19:00' },
      6: { inizio: '14:00', fine: '20:00' },
      7: { inizio: '13:00', fine: '20:00' },
      8: { inizio: '13:00', fine: '21:00' }
    },
    CENTRALE: {
      5: { inizio: '13:00', fine: '18:00' },
      6: { inizio: '13:00', fine: '19:00' },
      7: { inizio: '12:00', fine: '19:00' },
      8: { inizio: '12:00', fine: '20:00' }
    },
    CHIUSURA: {
      5: { inizio: '17:00', fine: '22:00' },
      6: { inizio: '16:00', fine: '22:00' },
      7: { inizio: '15:00', fine: '22:00' },
      8: { inizio: '14:00', fine: '22:00' }
    },
    FERIE: { inizio: '00:00', fine: '00:00' },
    MALATTIA: { inizio: '00:00', fine: '00:00' }
  };

  return orari[tipoTurno]?.[oreGiorno] || orari[tipoTurno]?.[8] || { inizio: '09:30', fine: '17:30' };
};

const TurnoModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  userId, 
  userName,
  giorno, 
  settimana,
  turnoEsistente 
}) => {
  const [tipoTurno, setTipoTurno] = useState('APERTURA');
  const [oraInizio, setOraInizio] = useState('09:30');
  const [oraFine, setOraFine] = useState('17:30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oreSettimanali, setOreSettimanali] = useState(36);

  useEffect(() => {
    if (isOpen && userId) {
      caricaDatiUtente();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (turnoEsistente) {
      // Modifica turno esistente
      setTipoTurno(turnoEsistente.tipo_turno);
      setOraInizio(turnoEsistente.ora_inizio.substring(0, 5));
      setOraFine(turnoEsistente.ora_fine.substring(0, 5));
    } else {
      // Nuovo turno - imposta default in base a ore contratto
      setTipoTurno('APERTURA');
      const oreGiorno = calcolaOreGiornaliere(oreSettimanali);
      const orari = getOrariPredefiniti('APERTURA', oreGiorno);
      setOraInizio(orari.inizio);
      setOraFine(orari.fine);
    }
    setError(null);
  }, [turnoEsistente, isOpen, oreSettimanali]);

  const caricaDatiUtente = async () => {
    try {
      const response = await getUserById(userId);
      setOreSettimanali(response.data.user.ore_settimanali);
    } catch (err) {
      console.error('Errore caricamento dati utente:', err);
    }
  };

  const handleTipoChange = (tipo) => {
    setTipoTurno(tipo);
    // Imposta orari modulari in base al tipo e ore giornaliere
    const oreGiorno = calcolaOreGiornaliere(oreSettimanali);
    const orari = getOrariPredefiniti(tipo, oreGiorno);
    setOraInizio(orari.inizio);
    setOraFine(orari.fine);
  };

  const calcolaOre = () => {
    if (!oraInizio || !oraFine) return 0;
    
    const [hInizio, mInizio] = oraInizio.split(':').map(Number);
    const [hFine, mFine] = oraFine.split(':').map(Number);
    
    const minInizio = hInizio * 60 + mInizio;
    const minFine = hFine * 60 + mFine;
    
    return ((minFine - minInizio) / 60).toFixed(1);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const turnoData = {
        user_id: userId,
        settimana: settimana,
        giorno_settimana: giorno,
        ora_inizio: oraInizio + ':00',
        ora_fine: oraFine + ':00',
        tipo_turno: tipoTurno
      };

      await createOrUpdateTurno(turnoData);
      
      onSave && onSave();
      onClose();
    } catch (err) {
      console.error('Errore salvataggio turno:', err);
      setError(err.response?.data?.error || 'Errore nel salvataggio del turno');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!turnoEsistente) return;
    
    if (!window.confirm('Sei sicuro di voler eliminare questo turno?')) {
      return;
    }

    try {
      setLoading(true);
      await deleteTurno(turnoEsistente.id);
      onSave && onSave();
      onClose();
    } catch (err) {
      console.error('Errore eliminazione turno:', err);
      setError('Errore nell\'eliminazione del turno');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const oreGiorno = calcolaOreGiornaliere(oreSettimanali);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{turnoEsistente ? 'Modifica Turno' : 'Nuovo Turno'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Dipendente</label>
              <div className="form-value">{userName}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Giorno</label>
              <div className="form-value">
                {GIORNI[giorno]} - {new Date(new Date(settimana).getTime() + giorno * 86400000)
                  .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ore Contratto / Ore Giornaliere</label>
              <div className="form-value">
                {oreSettimanali}h/sett → {oreGiorno}h/giorno
              </div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Tipo Turno</label>
            <div className="tipo-turno-buttons">
              {TIPI_TURNO.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  className={`tipo-btn ${tipoTurno === tipo ? 'active' : ''}`}
                  onClick={() => handleTipoChange(tipo)}
                  disabled={loading}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          {tipoTurno !== 'FERIE' && tipoTurno !== 'MALATTIA' && (
            <div className="form-section">
              <div className="orari-group">
                <div className="form-group">
                  <label className="form-label">Ora Inizio</label>
                  <input
                    type="time"
                    className="form-control"
                    value={oraInizio}
                    onChange={(e) => setOraInizio(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ora Fine</label>
                  <input
                    type="time"
                    className="form-control"
                    value={oraFine}
                    onChange={(e) => setOraFine(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="ore-totali">
                Ore totali: <strong>{calcolaOre()}h</strong>
                {parseFloat(calcolaOre()) !== oreGiorno && (
                  <span className="ore-warning"> ⚠️ Atteso: {oreGiorno}h</span>
                )}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          {turnoEsistente && (
            <button 
              className="btn-delete" 
              onClick={handleDelete}
              disabled={loading}
            >
              🗑️ Elimina
            </button>
          )}
          <div className="modal-actions">
            <button 
              className="btn-cancel" 
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </button>
            <button 
              className="btn-save" 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TurnoModal;