// Modal Dettaglio Presidio Giornaliero
import React, { useState, useEffect } from 'react';
import { getTurniSettimana } from '../api/axios';
import './GiornoDetailModal.css';

const GIORNI_NOMI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const GiornoDetailModal = ({ isOpen, onClose, settimana, giorno }) => {
  const [turni, setTurni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fasceOrarie, setFasceOrarie] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadTurni();
    }
  }, [isOpen, settimana, giorno]);

  const loadTurni = async () => {
    try {
      setLoading(true);
      const response = await getTurniSettimana(settimana);
      const turniGiorno = response.data.turni[giorno] || [];
      
      // Filtra solo turni lavorativi (non OFF)
      const turniLavorativi = turniGiorno.filter(t => t.tipo_turno !== 'OFF');
      setTurni(turniLavorativi);
      
      // Genera fasce orarie
      generaFasceOrarie(turniLavorativi);
    } catch (err) {
      console.error('Errore caricamento turni:', err);
    } finally {
      setLoading(false);
    }
  };

  const generaFasceOrarie = (turniGiorno) => {
    const fasce = [];
    
    // Genera fasce da 09:00 a 22:00 ogni 30 minuti
    for (let ora = 9; ora < 22; ora++) {
      for (let minuti = 0; minuti < 60; minuti += 30) {
        const oraInizio = `${ora.toString().padStart(2, '0')}:${minuti.toString().padStart(2, '0')}`;
        const minutiSuccessivi = minuti + 30;
        const oraFine = minutiSuccessivi === 60
          ? `${(ora + 1).toString().padStart(2, '0')}:00`
          : `${ora.toString().padStart(2, '0')}:${minutiSuccessivi.toString().padStart(2, '0')}`;
        
        // Trova dipendenti presenti in questa fascia
        const dipendentiPresenti = turniGiorno.filter(turno => {
          const turnoInizio = turno.ora_inizio.substring(0, 5);
          const turnoFine = turno.ora_fine.substring(0, 5);
          
          // Verifica se il turno copre questa fascia
          return turnoInizio <= oraInizio && turnoFine > oraInizio;
        });
        
        fasce.push({
          oraInizio,
          oraFine,
          dipendenti: dipendentiPresenti,
          count: dipendentiPresenti.length
        });
      }
    }
    
    // Fascia finale 22:00-22:00
    const ultimaFascia = turniGiorno.filter(t => {
      const turnoFine = t.ora_fine.substring(0, 5);
      return turnoFine === '22:00';
    });
    
    if (ultimaFascia.length > 0) {
      fasce.push({
        oraInizio: '22:00',
        oraFine: '22:00',
        dipendenti: ultimaFascia,
        count: ultimaFascia.length
      });
    }
    
    setFasceOrarie(fasce);
  };

  const getCountClass = (count) => {
    if (count === 0) return '';
    if (count < 2) return 'count-insufficient';
    if (count === 2) return 'count-warning';
    return 'count-ok';
  };

  const getBadgeClass = (tipo) => {
    switch (tipo) {
      case 'APERTURA': return 'badge-apertura';
      case 'CENTRALE': return 'badge-centrale';
      case 'CENTRALE-A': return 'badge-centrale-a';
      case 'CENTRALE-B': return 'badge-centrale-b';
      case 'CHIUSURA': return 'badge-chiusura';
      case 'FERIE': return 'badge-ferie';
      case 'MALATTIA': return 'badge-malattia';
      default: return '';
    }
  };

  const getTurnoIcon = (tipo) => {
    switch (tipo) {
      case 'APERTURA': return '🌅';
      case 'CENTRALE': return '☀️';
      case 'CENTRALE-A': return '☀️';
      case 'CENTRALE-B': return '☀️';
      case 'CHIUSURA': return '🌙';
      case 'FERIE': return '🏖️';
      case 'MALATTIA': return '🤒';
      default: return '💼';
    }
  };

  const calcolaStatistiche = () => {
    const totaleDipendenti = turni.length;
    const fasceInsufficienti = fasceOrarie.filter(f => f.count > 0 && f.count < 2).length;
    const mediaPresenze = fasceOrarie.length > 0
      ? (fasceOrarie.reduce((sum, f) => sum + f.count, 0) / fasceOrarie.length).toFixed(1)
      : 0;
    const piccoPresenze = Math.max(...fasceOrarie.map(f => f.count), 0);
    
    return { totaleDipendenti, fasceInsufficienti, mediaPresenze, piccoPresenze };
  };

  const getPresidioStatus = () => {
    const stats = calcolaStatistiche();
    
    if (stats.fasceInsufficienti > 5) {
      return {
        type: 'danger',
        icon: '🔴',
        message: `Presidio INSUFFICIENTE: ${stats.fasceInsufficienti} fasce con meno di 2 persone`
      };
    }
    
    if (stats.fasceInsufficienti > 0) {
      return {
        type: 'warning',
        icon: '🟡',
        message: `Presidio PARZIALE: ${stats.fasceInsufficienti} fasce con meno di 2 persone`
      };
    }
    
    return {
      type: 'success',
      icon: '🟢',
      message: 'Presidio COMPLETO: tutte le fasce coperte adeguatamente'
    };
  };

  if (!isOpen) return null;

  const nomeGiorno = GIORNI_NOMI[giorno];
  const dataGiorno = new Date(new Date(settimana).getTime() + giorno * 86400000);
  const dataFormattata = dataGiorno.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const stats = calcolaStatistiche();
  const presidioStatus = getPresidioStatus();

  return (
    <div className="giorno-modal-overlay" onClick={onClose}>
      <div className="giorno-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="giorno-modal-header">
          <h3>
            📅 Dettaglio Presidio
            <span className="giorno-nome-badge">
              {nomeGiorno} {dataFormattata}
            </span>
          </h3>
          <button className="giorno-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="giorno-modal-body">
          {loading ? (
            <div className="giorno-loading">
              <div className="spinner"></div>
              <p>Caricamento dettagli...</p>
            </div>
          ) : (
            <>
              {/* Statistiche */}
              <div className="giorno-stats">
                <div className="giorno-stat-card">
                  <div className="stat-value">{stats.totaleDipendenti}</div>
                  <div className="stat-label">Dipendenti</div>
                </div>
                <div className="giorno-stat-card">
                  <div className="stat-value">{stats.mediaPresenze}</div>
                  <div className="stat-label">Media Presenze</div>
                </div>
                <div className="giorno-stat-card">
                  <div className="stat-value">{stats.piccoPresenze}</div>
                  <div className="stat-label">Picco Presenze</div>
                </div>
                <div className="giorno-stat-card">
                  <div className="stat-value" style={{ color: stats.fasceInsufficienti > 0 ? '#dc3545' : '#28a745' }}>
                    {stats.fasceInsufficienti}
                  </div>
                  <div className="stat-label">Fasce Critiche</div>
                </div>
              </div>

              {/* Alert Presidio */}
              <div className={`presidio-alert alert-${presidioStatus.type}`}>
                <span className="alert-icon">{presidioStatus.icon}</span>
                <span>{presidioStatus.message}</span>
              </div>

              {/* Tabella Fasce Orarie */}
              <div className="fascia-oraria-table-wrapper">
                <table className="fascia-oraria-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Fascia Oraria</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Presenze</th>
                      <th>Dipendenti Presenti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fasceOrarie.map((fascia, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="fascia-ora">
                            {fascia.oraInizio} - {fascia.oraFine}
                          </span>
                        </td>
                        <td>
                          <span className={`fascia-count ${getCountClass(fascia.count)}`}>
                            {fascia.count}
                          </span>
                        </td>
                        <td>
                          {fascia.dipendenti.length > 0 ? (
                            <div className="fascia-dipendenti">
                              {fascia.dipendenti.map((dip, i) => (
                                <span
                                  key={i}
                                  className={`dipendente-badge ${getBadgeClass(dip.tipo_turno)}`}
                                >
                                  <span className="turno-icon">{getTurnoIcon(dip.tipo_turno)}</span>
                                  <span className="dipendente-nome">{dip.nome}</span>
                                  <span style={{ opacity: 0.7, fontSize: '10px' }}>
                                    ({dip.ora_inizio.substring(0, 5)}-{dip.ora_fine.substring(0, 5)})
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="empty-fascia">Nessun dipendente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div className="legenda">
                <strong style={{ width: '100%', marginBottom: '10px' }}>Legenda:</strong>
                <div className="legenda-item">
                  <div className="legenda-color" style={{ background: '#28a745' }}></div>
                  <span>≥ 3 persone (Ottimale)</span>
                </div>
                <div className="legenda-item">
                  <div className="legenda-color" style={{ background: '#ffc107' }}></div>
                  <span>2 persone (Sufficiente)</span>
                </div>
                <div className="legenda-item">
                  <div className="legenda-color" style={{ background: '#dc3545' }}></div>
                  <span>&lt; 2 persone (Insufficiente)</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiornoDetailModal;