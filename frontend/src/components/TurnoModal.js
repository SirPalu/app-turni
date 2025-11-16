// Modal per inserimento/modifica turno - FIXED orari martedì/giovedì
import React, { useState, useEffect } from 'react';
import { createOrUpdateTurno, deleteTurno, getUserById } from '../api/axios';
import './TurnoModal.css';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const TIPI_TURNO = ['OFF', 'APERTURA', 'CENTRALE-A', 'CENTRALE-B', 'CENTRALE', 'CHIUSURA', 'FERIE', 'MALATTIA', 'NL'];

// Calcola ore giornaliere in base a contratto
const calcolaOreGiornaliere = (oreSettimanali) => {
  const oreGiorno = oreSettimanali / 5;
  if (oreGiorno >= 7.5) return 8;
  if (oreGiorno >= 6.5) return 7;
  if (oreGiorno >= 5.5) return 6;
  return 5;
};

// ✅ ORARI PREDEFINITI MODULARI CON PAUSA PRANZO E CORREZIONE MAR/GIO
const getOrariPredefiniti = (tipoTurno, oreGiorno, oreSettimanali = 36, giornoSettimana = 0) => {
  const conPausa = oreSettimanali >= 30;
  
  // ✅ MARTEDÌ (1) e GIOVEDÌ (3) hanno apertura alle 9:00
  const oraApertura = (giornoSettimana === 1 || giornoSettimana === 3) ? '09:00' : '09:30';
  
  // ✅ Se apertura anticipata (9:00), anche la fine è anticipata di 30 min
  const offsetApertura = (giornoSettimana === 1 || giornoSettimana === 3) ? -0.5 : 0;
  
  const orari = {
    APERTURA: {
      // ✅ Tutti i finali scalati di 30 min per mar/gio
      5: { 
        inizio: oraApertura, 
        fine: aggiungiOre(conPausa ? '15:00' : '14:30', offsetApertura)
      },
      6: { 
        inizio: oraApertura, 
        fine: aggiungiOre(conPausa ? '16:00' : '15:30', offsetApertura)
      },
      7: { 
        inizio: oraApertura, 
        fine: aggiungiOre(conPausa ? '17:00' : '16:30', offsetApertura)
      },
      8: { 
        inizio: oraApertura, 
        fine: aggiungiOre(conPausa ? '18:00' : '17:30', offsetApertura)
      }
    },
    'CENTRALE-A': {
      5: { inizio: '12:00', fine: conPausa ? '17:30' : '17:00' },
      6: { inizio: '12:00', fine: conPausa ? '18:30' : '18:00' },
      7: { inizio: '12:00', fine: conPausa ? '19:30' : '19:00' },
      8: { inizio: '11:00', fine: conPausa ? '19:30' : '19:00' }
    },
    'CENTRALE-B': {
      5: { inizio: '14:00', fine: conPausa ? '19:30' : '19:00' },
      6: { inizio: '14:00', fine: conPausa ? '20:30' : '20:00' },
      7: { inizio: '13:00', fine: conPausa ? '20:30' : '20:00' },
      8: { inizio: '13:00', fine: conPausa ? '21:30' : '21:00' }
    },
    CENTRALE: {
      5: { inizio: '13:00', fine: conPausa ? '18:30' : '18:00' },
      6: { inizio: '13:00', fine: conPausa ? '19:30' : '19:00' },
      7: { inizio: '12:00', fine: conPausa ? '19:30' : '19:00' },
      8: { inizio: '12:00', fine: conPausa ? '20:30' : '20:00' }
    },
    CHIUSURA: {
      5: { inizio: conPausa ? '16:30' : '17:00', fine: '22:00' },
      6: { inizio: conPausa ? '15:30' : '16:00', fine: '22:00' },
      7: { inizio: conPausa ? '14:30' : '15:00', fine: '22:00' },
      8: { inizio: conPausa ? '13:30' : '14:00', fine: '22:00' }
    },
    FERIE: { inizio: '00:00', fine: '00:00' },
    MALATTIA: { inizio: '00:00', fine: '00:00' },
    NL: { inizio: '00:00', fine: '00:00' },
    OFF: { inizio: '00:00', fine: '00:00' }
  };

  return orari[tipoTurno]?.[oreGiorno] || orari[tipoTurno]?.[8] || { inizio: oraApertura, fine: '17:30' };
};

// ✅ HELPER: Aggiungi/sottrai ore da un orario HH:MM
const aggiungiOre = (orario, offsetOre) => {
  if (offsetOre === 0) return orario;
  
  const [ore, minuti] = orario.split(':').map(Number);
  const minutiTotali = ore * 60 + minuti + (offsetOre * 60);
  
  const nuoveOre = Math.floor(minutiTotali / 60);
  const nuoviMinuti = minutiTotali % 60;
  
  return `${String(nuoveOre).padStart(2, '0')}:${String(nuoviMinuti).padStart(2, '0')}`;
};

// Calcola ore per FERIE/MALATTIA in base a contratto
const calcolaOreFerieMalattia = (oreSettimanali) => {
  if (oreSettimanali === 40) return 8;
  return Math.round((oreSettimanali / 6) * 10) / 10;
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
  const [oreNL, setOreNL] = useState(0); // ✅ Ore NL personalizzate
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
      const orari = getOrariPredefiniti('APERTURA', oreGiorno, oreSettimanali, giorno);
      setOraInizio(orari.inizio);
      setOraFine(orari.fine);
    }
    setError(null);
  }, [turnoEsistente, isOpen, oreSettimanali, giorno]);

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
    const orari = getOrariPredefiniti(tipo, oreGiorno, oreSettimanali, giorno);
    setOraInizio(orari.inizio);
    setOraFine(orari.fine);
  };

  const calcolaOre = () => {
    // FERIE e MALATTIA usano calcolo proporzionato
    if (tipoTurno === 'FERIE' || tipoTurno === 'MALATTIA') {
      return calcolaOreFerieMalattia(oreSettimanali);
    }
    
    // NL: ore personalizzate (usa il campo ore_effettive manuale)
    if (tipoTurno === 'NL') {
      return 0; // Verrà impostato manualmente
    }
    
    if (!oraInizio || !oraFine) return 0;
    
    const [hInizio, mInizio] = oraInizio.split(':').map(Number);
    const [hFine, mFine] = oraFine.split(':').map(Number);
    
    const minInizio = hInizio * 60 + mInizio;
    const minFine = hFine * 60 + mFine;
    
    let oreTotali = (minFine - minInizio) / 60;
    
    // Sottrai pausa pranzo se >= 30h contratto
    if (oreSettimanali >= 30 && !['OFF', 'FERIE', 'MALATTIA', 'NL'].includes(tipoTurno)) {
      oreTotali -= 0.5; // -30 minuti
    }
    
    return oreTotali.toFixed(1);
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
  const mostraOrari = !['OFF', 'FERIE', 'MALATTIA'].includes(tipoTurno);
  const nomeGiorno = GIORNI[giorno];

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
                {nomeGiorno} - {new Date(new Date(settimana).getTime() + giorno * 86400000)
                  .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {(giorno === 1 || giorno === 3) && (
                  <span style={{ marginLeft: '10px', color: '#007bff', fontWeight: 'bold' }}>
                    ⏰ Apertura anticipata (9:00)
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ore Contratto / Ore Giornaliere</label>
              <div className="form-value">
                {oreSettimanali}h/sett → {oreGiorno}h/giorno
                {oreSettimanali >= 30 && ' (con pausa pranzo 30min)'}
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

          {mostraOrari && (
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