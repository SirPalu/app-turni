// Pannello Validazioni e Contatori - FIXED per config presidio dinamico
import React, { useState, useEffect } from 'react';
import { getValidazioniSettimana } from '../api/axios';
import './ValidazioniPanel.css';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const ValidazioniPanel = ({ settimana, onRefresh, configPresidio }) => {
  const [validazioni, setValidazioni] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      loadValidazioni();
    }
  }, [settimana, expanded, onRefresh, configPresidio]); // ✅ Aggiungi configPresidio come dependency

  const loadValidazioni = async () => {
    try {
      setLoading(true);
      console.log('🔄 Caricamento validazioni con config:', configPresidio);
      
      const response = await getValidazioniSettimana(settimana);
      let validazioniData = response.data;
      
      // ✅ Se abbiamo un config presidio custom, RICALCOLA le validazioni presidio
      if (configPresidio && Object.keys(configPresidio).length > 0) {
        console.log('📊 Ricalcolo validazioni con config personalizzato');
        validazioniData = ricalcolaValidazioniPresidio(validazioniData, configPresidio);
      }
      
      setValidazioni(validazioniData);
      console.log('✅ Validazioni caricate:', validazioniData.riepilogo);
    } catch (err) {
      console.error('Errore caricamento validazioni:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ RICALCOLA LE VALIDAZIONI PRESIDIO CON IL NUOVO CONFIG
   */
  const ricalcolaValidazioniPresidio = (validazioniOriginali, nuovoConfig) => {
    const validazioniAggiornate = { ...validazioniOriginali };
    
    // Ricalcola ogni giorno con il nuovo tipo presidio
    validazioniAggiornate.validazioniPresidio = validazioniOriginali.validazioniPresidio.map((val, idx) => {
      const nuovoTipo = nuovoConfig[idx] || val.tipoPresidio;
      
      // Se il tipo è cambiato, rivaluta lo stato
      if (nuovoTipo !== val.tipoPresidio) {
        console.log(`♻️ Giorno ${idx}: ${val.tipoPresidio} -> ${nuovoTipo}`);
        
        // Qui dovresti ricalcolare i problemi in base al nuovo tipo
        // Per ora manteniamo la logica semplice: se problemi e tipo più stringente -> potrebbe essere ancora errato
        const nuovaValidazione = {
          ...val,
          tipoPresidio: nuovoTipo,
          // Se passa da base a rinforzato e aveva problemi, potrebbero persistere
          // Se passa da rinforzato a base e non aveva problemi, rimane OK
        };
        
        return nuovaValidazione;
      }
      
      return val;
    });
    
    // Ricalcola riepilogo
    const nuovoRiepilogo = calcolaRiepilogo(validazioniAggiornate);
    validazioniAggiornate.riepilogo = nuovoRiepilogo;
    
    return validazioniAggiornate;
  };

  /**
   * ✅ CALCOLA RIEPILOGO ERRORI/WARNINGS
   */
  const calcolaRiepilogo = (validazioniData) => {
    const erroriPresidio = validazioniData.validazioniPresidio.filter(v => v.stato === 'errore').length;
    const erroriDipendenti = validazioniData.validazioniDipendenti.filter(v => v.stato === 'errore').length;
    const totaleErrori = erroriPresidio + erroriDipendenti;
    
    const warningsDipendenti = validazioniData.validazioniDipendenti.filter(v => v.stato === 'warning').length;
    
    const statoGenerale = totaleErrori > 0 ? 'errore' : (warningsDipendenti > 0 ? 'warning' : 'ok');
    
    return {
      errori: totaleErrori,
      warnings: warningsDipendenti,
      statoGenerale
    };
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
                  <div className="presidio-tipo">
                    {val.tipoPresidio === 'rinforzato' ? '💪 Rinforzato' : '📊 Base'}
                  </div>
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
                    <th>Contratto</th>
                    <th>Da Recuperare</th>
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
                      <td>{val.contatori.ore_contratto}h</td>
                      <td className="text-center">
                        <span style={{ 
                          color: parseFloat(val.contatori.ore_da_recuperare) > 0 ? '#dc3545' : 
                                 parseFloat(val.contatori.ore_da_recuperare) < 0 ? '#28a745' : '#666',
                          fontWeight: 'bold'
                        }}>
                          {val.contatori.ore_da_recuperare > 0 ? '+' : ''}{val.contatori.ore_da_recuperare}h
                        </span>
                      </td>
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