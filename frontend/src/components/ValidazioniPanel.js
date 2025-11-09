// Pannello Validazioni e Contatori
import React, { useState, useEffect } from 'react';
import { getValidazioniSettimana } from '../api/axios';
import './ValidazioniPanel.css';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const ValidazioniPanel = ({ settimana, onRefresh }) => {
  const [validazioni, setValidazioni] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      loadValidazioni();
    }
  }, [settimana, expanded, onRefresh]);

  const loadValidazioni = async () => {
    try {
      setLoading(true);
      const response = await getValidazioniSettimana(settimana);
      setValidazioni(response.data);
    } catch (err) {
      console.error('Errore caricamento validazioni:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatoIcon = (stato) => {
    switch (stato) {
      case 'ok': return '🟢';
      case 'warning': return '🟡';
      case 'errore': return '🔴';
      default: return '⚪';
    }
  };

  const getStatoClass = (stato) => {
    switch (stato) {
      case 'ok': return 'stato-ok';
      case 'warning': return 'stato-warning';
      case 'errore': return 'stato-errore';
      default: return '';
    }
  };

  if (!expanded) {
    return (
      <div className="validazioni-compact">
        <button 
          className="btn-validazioni-expand"
          onClick={() => setExpanded(true)}
        >
          📊 Mostra Validazioni e Contatori
        </button>
      </div>
    );
  }

  return (
    <div className="validazioni-panel">
      <div className="validazioni-header">
        <h3>📊 Validazioni e Contatori</h3>
        <div className="validazioni-actions">
          <button onClick={loadValidazioni} disabled={loading} className="btn-refresh">
            🔄 Aggiorna
          </button>
          <button onClick={() => setExpanded(false)} className="btn-collapse">
            ▲ Nascondi
          </button>
        </div>
      </div>

      {loading && <div className="validazioni-loading">Caricamento...</div>}

      {validazioni && (
        <>
          {/* Riepilogo Generale */}
          <div className={`validazioni-riepilogo ${getStatoClass(validazioni.riepilogo.statoGenerale)}`}>
            <div className="riepilogo-item">
              <span className="riepilogo-icon">
                {getStatoIcon(validazioni.riepilogo.statoGenerale)}
              </span>
              <span className="riepilogo-text">
                Stato Generale: <strong>{validazioni.riepilogo.statoGenerale.toUpperCase()}</strong>
              </span>
            </div>
            <div className="riepilogo-stats">
              <span className="stat-errori">
                🔴 Errori: {validazioni.riepilogo.errori}
              </span>
              <span className="stat-warnings">
                🟡 Avvisi: {validazioni.riepilogo.warnings}
              </span>
            </div>
          </div>

          {/* Validazioni Presidio */}
          <div className="validazioni-section">
            <h4>🏪 Presidio Giornaliero</h4>
            <div className="presidio-grid">
              {validazioni.validazioniPresidio.map((val, idx) => (
                <div key={idx} className={`presidio-card ${getStatoClass(val.stato)}`}>
                  <div className="presidio-header">
                    <span className="presidio-giorno">{GIORNI[val.giorno]}</span>
                    <span className="presidio-icon">{getStatoIcon(val.stato)}</span>
                  </div>
                  <div className="presidio-tipo">{val.tipoPresidio}</div>
                  {val.problemi.length > 0 && (
                    <div className="presidio-problemi">
                      {val.problemi.map((problema, i) => (
                        <div key={i} className="problema-item">⚠️ {problema}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Validazioni Dipendenti */}
          <div className="validazioni-section">
            <h4>👥 Contatori Dipendenti</h4>
            <div className="dipendenti-table-wrapper">
              <table className="dipendenti-table">
                <thead>
                  <tr>
                    <th>Dipendente</th>
                    <th>Stato</th>
                    <th>Ore</th>
                    <th>OFF</th>
                    <th>Chiusure</th>
                    <th>Aperture</th>
                    <th>Sab</th>
                    <th>Dom</th>
                    <th>Problemi</th>
                  </tr>
                </thead>
                <tbody>
                  {validazioni.validazioniDipendenti.map((val) => (
                    <tr key={val.userId} className={getStatoClass(val.stato)}>
                      <td><strong>{val.nome}</strong></td>
                      <td className="text-center">{getStatoIcon(val.stato)}</td>
                      <td>{val.contatori.ore_lavorate}h</td>
                      <td>{val.contatori.giorni_off}</td>
                      <td>{val.contatori.chiusure}</td>
                      <td>{val.contatori.aperture}</td>
                      <td>{val.contatori.pfes}</td>
                      <td>{val.contatori.fes}</td>
                      <td className="problemi-cell">
                        {val.errori.length > 0 && (
                          <div className="errori-list">
                            {val.errori.map((err, i) => (
                              <div key={i} className="errore-item">🔴 {err}</div>
                            ))}
                          </div>
                        )}
                        {val.warnings.length > 0 && (
                          <div className="warnings-list">
                            {val.warnings.map((warn, i) => (
                              <div key={i} className="warning-item">🟡 {warn}</div>
                            ))}
                          </div>
                        )}
                        {val.errori.length === 0 && val.warnings.length === 0 && (
                          <span className="ok-text">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ValidazioniPanel;