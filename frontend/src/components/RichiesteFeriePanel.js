// Pannello Gestione Richieste Ferie Admin
import React, { useState, useEffect } from 'react';
import { getTutteRichiesteFerie, gestisciRichiestaFerie, getAllUsers } from '../api/axios';
import './RichiesteFeriePanel.css';

const RichiesteFeriePanel = ({ onUpdate }) => {
  const [richieste, setRichieste] = useState([]);
  const [utenti, setUtenti] = useState([]);
  const [filtroStato, setFiltroStato] = useState('in_attesa');
  const [filtroUtente, setFiltroUtente] = useState('');
  const [inAttesaCount, setInAttesaCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // Modal per note rifiuto
  const [modalOpen, setModalOpen] = useState(false);
  const [richiestaSelezionata, setRichiestaSelezionata] = useState(null);
  const [azioneCorrente, setAzioneCorrente] = useState(null);
  const [noteAdmin, setNoteAdmin] = useState('');

  useEffect(() => {
    loadUtenti();
    loadRichieste();
  }, [filtroStato, filtroUtente]);

  const loadUtenti = async () => {
    try {
      const response = await getAllUsers();
      const dipendenti = response.data.users.filter(u => u.ruolo !== 'manager');
      setUtenti(dipendenti);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
    }
  };

  const loadRichieste = async () => {
    try {
      setLoading(true);
      const filtri = {};
      if (filtroStato) filtri.stato = filtroStato;
      if (filtroUtente) filtri.userId = filtroUtente;

      const response = await getTutteRichiesteFerie(filtri);
      setRichieste(response.data.richieste);
      setInAttesaCount(response.data.in_attesa_count);
    } catch (err) {
      console.error('Errore caricamento richieste:', err);
      setError('Errore nel caricamento delle richieste');
    } finally {
      setLoading(false);
    }
  };

  const handleAzione = (richiesta, azione) => {
    setRichiestaSelezionata(richiesta);
    setAzioneCorrente(azione);
    setNoteAdmin('');

    if (azione === 'rifiuta') {
      // Per rifiuto, chiedi sempre note
      setModalOpen(true);
    } else {
      // Per approva e converti_off, esegui direttamente
      const conferma = window.confirm(
        `Confermi di voler ${azione === 'approva' ? 'APPROVARE' : 'CONVERTIRE IN OFF'} la richiesta di ${richiesta.dipendente_nome} per il ${formatData(richiesta.data_richiesta)}?`
      );
      
      if (conferma) {
        eseguiAzione(richiesta.id, azione, '');
      }
    }
  };

  const eseguiAzione = async (richiestaId, azione, note) => {
    try {
      setLoading(true);
      setError(null);

      await gestisciRichiestaFerie(richiestaId, azione, note);

      const messaggi = {
        approva: '✅ Ferie approvata',
        rifiuta: '❌ Richiesta rifiutata',
        converti_off: '🔄 Convertita in OFF'
      };

      setMessage(messaggi[azione]);
      setTimeout(() => setMessage(null), 3000);
      
      loadRichieste();
      setModalOpen(false);
      setRichiestaSelezionata(null);

      // Notifica parent component se esiste callback
if (onUpdate) {
  onUpdate();
}

    } catch (err) {
      console.error('Errore gestione richiesta:', err);
      setError(err.response?.data?.error || 'Errore nella gestione della richiesta');
    } finally {
      setLoading(false);
    }
  };

  const handleModalConfirm = () => {
    if (azioneCorrente === 'rifiuta' && !noteAdmin.trim()) {
      alert('Inserisci una motivazione per il rifiuto');
      return;
    }

    eseguiAzione(richiestaSelezionata.id, azioneCorrente, noteAdmin);
  };

  const formatData = (dataStr) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('it-IT', { 
      weekday: 'short',
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const calcolaGiorniFa = (dataStr) => {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const data = new Date(dataStr);
    const diffTime = data - oggi;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Oggi';
    if (diffDays === 1) return 'Domani';
    if (diffDays === -1) return 'Ieri';
    if (diffDays > 0) return `Tra ${diffDays} giorni`;
    return `${Math.abs(diffDays)} giorni fa`;
  };

  const resetFiltri = () => {
    setFiltroStato('in_attesa');
    setFiltroUtente('');
  };

  const getStatoLabel = (stato) => {
    const labels = {
      in_attesa: 'In Attesa',
      approvata: 'Approvata',
      rifiutata: 'Rifiutata',
      off_approvato: 'OFF Approvato'
    };
    return labels[stato] || stato;
  };

  return (
    <div className="richieste-ferie-panel">
      <div className="panel-header">
        <h3>
          📋 Richieste Ferie
          {inAttesaCount > 0 && (
            <span className="notifica-badge">{inAttesaCount}</span>
          )}
        </h3>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="filtri-container">
        <div className="filtro-group">
          <label className="filtro-label">Stato:</label>
          <select 
            className="filtro-select"
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value)}
          >
            <option value="">Tutte</option>
            <option value="in_attesa">In Attesa</option>
            <option value="approvata">Approvate</option>
            <option value="rifiutata">Rifiutate</option>
            <option value="off_approvato">OFF Approvati</option>
          </select>
        </div>

        <div className="filtro-group">
          <label className="filtro-label">Dipendente:</label>
          <select 
            className="filtro-select"
            value={filtroUtente}
            onChange={(e) => setFiltroUtente(e.target.value)}
          >
            <option value="">Tutti</option>
            {utenti.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>

        {(filtroStato !== 'in_attesa' || filtroUtente) && (
          <button className="btn-reset-filtri" onClick={resetFiltri}>
            🔄 Reset Filtri
          </button>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Caricamento...</div>}

      {!loading && richieste.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">
            {filtroStato === 'in_attesa' 
              ? 'Nessuna richiesta in attesa' 
              : 'Nessuna richiesta trovata'}
          </div>
        </div>
      )}

      {!loading && richieste.length > 0 && (
        <div className="richieste-table-wrapper">
          <table className="richieste-table">
            <thead>
              <tr>
                <th>Dipendente</th>
                <th>Data Richiesta</th>
                <th>Data Invio</th>
                <th>Stato</th>
                <th>Note Admin</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {richieste.map((richiesta) => (
                <tr 
                  key={richiesta.id} 
                  className={`richiesta-row ${richiesta.tipo_approvazione === 'in_attesa' ? 'highlight' : ''}`}
                >
                  <td>
                    <div className="dipendente-info">
                      <span className="dipendente-nome">{richiesta.dipendente_nome}</span>
                      <span className="dipendente-dettagli">
                        {richiesta.ore_settimanali}h/sett
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="data-richiesta">{formatData(richiesta.data_richiesta)}</div>
                    <div className="giorni-fa">{calcolaGiorniFa(richiesta.data_richiesta)}</div>
                  </td>
                  <td>
                    {new Date(richiesta.richiesta_il).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className={`stato-badge stato-${richiesta.tipo_approvazione}`}>
                      {getStatoLabel(richiesta.tipo_approvazione)}
                    </span>
                  </td>
                  <td className="note-cell">
                    {richiesta.note_admin || '-'}
                  </td>
                  <td>
                    {richiesta.tipo_approvazione === 'in_attesa' ? (
                      <div className="azioni-cell">
                        <button 
                          className="btn-azione btn-approva"
                          onClick={() => handleAzione(richiesta, 'approva')}
                          disabled={loading}
                        >
                          ✅ Approva
                        </button>
                        <button 
                          className="btn-azione btn-converti"
                          onClick={() => handleAzione(richiesta, 'converti_off')}
                          disabled={loading}
                        >
                          🔄 Converti OFF
                        </button>
                        <button 
                          className="btn-azione btn-rifiuta"
                          onClick={() => handleAzione(richiesta, 'rifiuta')}
                          disabled={loading}
                        >
                          ❌ Rifiuta
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
                        Già gestita
                        {richiesta.admin_nome && (
                          <div>da {richiesta.admin_nome}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Note Rifiuto */}
      {modalOpen && (
        <div className="modal-overlay-note" onClick={() => setModalOpen(false)}>
          <div className="modal-content-note" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-note">
              <h3>❌ Rifiuta Richiesta Ferie</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body-note">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                <strong>Dipendente:</strong> {richiestaSelezionata?.dipendente_nome}<br />
                <strong>Data:</strong> {formatData(richiestaSelezionata?.data_richiesta)}
              </p>
              <div className="form-group">
                <label className="form-label">Motivazione Rifiuto *</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Inserisci il motivo del rifiuto..."
                  value={noteAdmin}
                  onChange={(e) => setNoteAdmin(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer-note">
              <button className="btn-modal-cancel" onClick={() => setModalOpen(false)}>
                Annulla
              </button>
              <button 
                className="btn-modal-confirm" 
                onClick={handleModalConfirm}
                disabled={!noteAdmin.trim()}
              >
                Conferma Rifiuto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichiesteFeriePanel;