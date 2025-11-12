// Pannello Storico Contatori
import React, { useState, useEffect } from 'react';
import { getStoricoRiassuntivo } from '../api/axios';
import './StoricoPanel.css';

const StoricoPanel = () => {
  const [storico, setStorico] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorico();
  }, []);

  const loadStorico = async () => {
    try {
      setLoading(true);
      const response = await getStoricoRiassuntivo();
      setStorico(response.data);
    } catch (err) {
      console.error('Errore caricamento storico:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDiffClass = (diff) => {
    const val = parseFloat(diff);
    if (val > 0.5) return 'diff-positive';
    if (val < -0.5) return 'diff-negative';
    return 'diff-neutral';
  };

  const formatDiff = (diff) => {
    const val = parseFloat(diff);
    if (val > 0) return `+${diff}`;
    return diff;
  };

  if (loading) {
    return <div className="loading">Caricamento storico...</div>;
  }

  if (!storico) {
    return <div className="loading">Nessuno storico disponibile</div>;
  }

  return (
    <div className="storico-panel">
      <div className="storico-header">
        <h3>📊 Storico Contatori Cumulativi</h3>
        <p className="storico-subtitle">
          Conteggio totale turni dall'inizio del tracciamento
        </p>
      </div>

      {/* Statistiche Generali */}
      <div className="storico-stats">
        <div className="stat-box">
          <div className="stat-box-label">Media Domeniche</div>
          <div className="stat-box-value">{storico.statistiche.media_domeniche}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-label">Media Sabati</div>
          <div className="stat-box-value">{storico.statistiche.media_sabati}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-label">Media Chiusure</div>
          <div className="stat-box-value">{storico.statistiche.media_chiusure}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-label">Dipendenti</div>
          <div className="stat-box-value">{storico.statistiche.totale_dipendenti}</div>
        </div>
      </div>

      {/* Tabella Riassuntiva */}
      <div className="storico-table-wrapper">
        <table className="storico-table">
          <thead>
            <tr>
              <th>Dipendente</th>
              <th className="text-center">Settimane</th>
              <th className="text-center">Ore Totali</th>
              <th className="text-center">Domeniche</th>
              <th className="text-center">Sabati</th>
              <th className="text-center">Chiusure</th>
              <th className="text-center">Aperture</th>
              <th className="text-center">OFF</th>
            </tr>
          </thead>
          <tbody>
            {storico.dipendenti.map((dip) => (
              <tr key={dip.id}>
                <td><strong>{dip.nome}</strong></td>
                <td className="text-center">{dip.settimane_lavorate}</td>
                <td className="text-center">{dip.ore_totali}h</td>
                <td className="text-center">
                  {dip.domeniche_totali}
                  {dip.diff_domeniche && (
                    <span className={getDiffClass(dip.diff_domeniche)}>
                      {' '}({formatDiff(dip.diff_domeniche)})
                    </span>
                  )}
                </td>
                <td className="text-center">
                  {dip.sabati_totali}
                  {dip.diff_sabati && (
                    <span className={getDiffClass(dip.diff_sabati)}>
                      {' '}({formatDiff(dip.diff_sabati)})
                    </span>
                  )}
                </td>
                <td className="text-center">
                  {dip.chiusure_totali}
                  {dip.diff_chiusure && (
                    <span className={getDiffClass(dip.diff_chiusure)}>
                      {' '}({formatDiff(dip.diff_chiusure)})
                    </span>
                  )}
                </td>
                <td className="text-center">{dip.aperture_totali}</td>
                <td className="text-center">{dip.off_totali}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
        <strong>Legenda:</strong> I numeri tra parentesi indicano lo scostamento dalla media.
        <span className="diff-positive"> Rosso = sopra media</span>,
        <span className="diff-negative"> Verde = sotto media</span>
      </div>
    </div>
  );
};

export default StoricoPanel;