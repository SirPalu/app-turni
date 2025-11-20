// Componente Tabella Turni Settimanali - CON ASSEGNAZIONE NL
import React, { useState, useEffect } from 'react';
import { getTurniSettimana, getAllUsers, updatePresidioGiorno, getConfigPresidio, getOreNLSettimana } from '../api/axios';
import GiornoDetailModal from './GiornoDetailModal';
import AssegnaNLModal from './AssegnaNLModal';
import './WeekTable.css';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const WeekTable = ({ 
  settimana, 
  editable = false, 
  onTurnoClick, 
  onPresidioChange,
  configPresidio: externalConfig 
}) => {
  const [turni, setTurni] = useState({});
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedGiornoDetail, setSelectedGiornoDetail] = useState(null);
  const [nlModalOpen, setNlModalOpen] = useState(false);
  const [selectedUserForNL, setSelectedUserForNL] = useState(null);
  const [oreNLPerUser, setOreNLPerUser] = useState({});
  
  const [configPresidio, setConfigPresidio] = useState(
    externalConfig || {
      0: 'base', 1: 'base', 2: 'base', 3: 'base', 4: 'base',
      5: 'rinforzato', 6: 'rinforzato'
    }
  );

  useEffect(() => {
    if (externalConfig) {
      console.log('📥 WeekTable ricevuto config esterno:', externalConfig);
      setConfigPresidio(externalConfig);
    }
  }, [externalConfig]);

  useEffect(() => {
    loadTurni();
  }, [settimana]);

  useEffect(() => {
    if (editable && !externalConfig) {
      loadConfigPresidioInternal();
    }
  }, [settimana, editable, externalConfig]);

  // ✅ Carica ore NL per tutti i dipendenti
  useEffect(() => {
    if (utenti.length > 0) {
      loadOreNL();
    }
  }, [utenti, settimana]);

  const loadTurni = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const turniResponse = await getTurniSettimana(settimana);
      const turniData = turniResponse.data.turni;
      setTurni(turniData);
      
      console.log('✅ Turni caricati:', Object.values(turniData).flat().length, 'turni totali');
      
      if (editable) {
        try {
          const usersResponse = await getAllUsers();
          const filteredUsers = usersResponse.data.users.filter(u => u.ruolo !== 'manager');
          setUtenti(filteredUsers);
        } catch (err) {
          console.error('Errore caricamento utenti (admin):', err);
          setError('Impossibile caricare la lista utenti');
        }
      } else {
        const allTurni = Object.values(turniData).flat();
        if (allTurni.length > 0) {
          const uniqueUsers = [...new Map(
            allTurni.map(t => [t.user_id, { id: t.user_id, nome: t.nome }])
          ).values()];
          setUtenti(uniqueUsers);
        } else {
          setUtenti([]);
        }
      }
      
    } catch (err) {
      console.error('Errore caricamento turni:', err);
      setError('Errore nel caricamento dei turni');
    } finally {
      setLoading(false);
    }
  };

  const loadConfigPresidioInternal = async () => {
    try {
      const response = await getConfigPresidio(settimana);
      setConfigPresidio(response.data.presidio);
    } catch (err) {
      console.error('Errore caricamento config presidio:', err);
    }
  };

  // ✅ Carica ore NL per la settimana
  const loadOreNL = async () => {
    try {
      const response = await getOreNLSettimana(settimana);
      const nlMap = {};
      response.data.ore_nl.forEach(nl => {
        nlMap[nl.user_id] = nl;
      });
      setOreNLPerUser(nlMap);
      console.log('✅ Ore NL caricate:', nlMap);
    } catch (err) {
      console.log('Nessuna ore NL per questa settimana');
      setOreNLPerUser({});
    }
  };

  const handlePresidioChange = async (giorno, nuovoTipo) => {
    if (!editable) return;

    try {
      console.log(`🔄 Cambio presidio: giorno ${giorno} -> ${nuovoTipo}`);
      
      await updatePresidioGiorno(settimana, giorno, nuovoTipo);
      console.log('✅ Presidio aggiornato nel DB');

      setConfigPresidio(prev => {
        const newConfig = { ...prev, [giorno]: nuovoTipo };
        console.log('📊 Nuovo config locale:', newConfig);
        return newConfig;
      });
      
      if (onPresidioChange) {
        console.log('📤 Notifica parent del cambio');
        onPresidioChange(giorno, nuovoTipo);
      }

    } catch (err) {
      console.error('Errore cambio presidio:', err);
      alert(`Errore: ${err.response?.data?.error || err.message}`);
      
      if (editable && !externalConfig) {
        loadConfigPresidioInternal();
      }
    }
  };

  // ✅ Gestione modal NL
  const handleOpenNLModal = (utente) => {
    setSelectedUserForNL(utente);
    setNlModalOpen(true);
  };

  const handleCloseNLModal = () => {
    setNlModalOpen(false);
    setSelectedUserForNL(null);
  };

  const handleSaveNL = () => {
    loadOreNL();
  };

  const getTurnoForUserDay = (userId, giorno) => {
    const turniGiorno = turni[giorno] || [];
    return turniGiorno.find(t => t.user_id === userId);
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  const getTurnoClass = (tipo) => {
    switch (tipo) {
      case 'APERTURA': return 'turno-apertura';
      case 'CENTRALE': return 'turno-centrale';
      case 'CENTRALE-A': return 'turno-centrale-a';
      case 'CENTRALE-B': return 'turno-centrale-b';
      case 'CHIUSURA': return 'turno-chiusura';
      case 'FERIE': return 'turno-ferie';
      case 'MALATTIA': return 'turno-malattia';
      case 'OFF': return 'turno-off';
      default: return '';
    }
  };

  if (loading) {
    return <div className="week-table-loading">Caricamento turni...</div>;
  }

  if (error) {
    return <div className="week-table-error">{error}</div>;
  }

  return (
    <div className="week-table-container">
      <div className="week-table-header">
        <h3>Settimana del {new Date(settimana).toLocaleDateString('it-IT', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        })}</h3>
      </div>

      <div className="week-table-wrapper">
        <table className="week-table">
          <thead>
            <tr>
              <th className="dipendente-col">Dipendente</th>
              {GIORNI.map((giorno, idx) => (
                <th key={idx} className="giorno-col">
                  <div 
                    className="giorno-header"
                    style={{ cursor: editable ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (editable) {
                        setSelectedGiornoDetail(idx);
                        setDetailModalOpen(true);
                      }
                    }}
                    title={editable ? "Clicca per vedere il dettaglio del presidio" : ""}
                  >
                    <div className="giorno-nome">
                      {giorno} 
                      {editable && (
                      <span style={{ fontSize: '12px', opacity: 0.8, marginLeft: '5px' }}>🔍</span>
                    )}
                    </div>
                    <div className="giorno-data">
  {(() => {
    const data = new Date(settimana + 'T00:00:00'); // Forza timezone locale
    data.setDate(data.getDate() + idx + 1); // correzione +1 giorno;
    return data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  })()}
</div>

                    {editable && (
                      <div className="presidio-selector" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="presidio-select"
                          value={configPresidio[idx] || 'base'}
                          onChange={(e) => handlePresidioChange(idx, e.target.value)}
                        >
                          <option value="base">📊 Base</option>
                          <option value="rinforzato">💪 Rinforzato</option>
                        </select>
                      </div>
                    )}

                    {!editable && (
                      <div className={`presidio-badge ${configPresidio[idx] || 'base'}`}>
                        {configPresidio[idx] === 'rinforzato' ? '💪 Rinf.' : '📊 Base'}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {utenti.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  {editable ? 'Caricamento utenti...' : 'Nessun turno pianificato per questa settimana'}
                </td>
              </tr>
            ) : (
              utenti.map(utente => (
                <tr key={utente.id}>
                  <td className="dipendente-cell">
                    <div className="dipendente-info-wrapper">
                      <strong>{utente.nome}</strong>
                      
                      {/* ✅ Badge ore NL */}
                      {oreNLPerUser[utente.id] && (
                        <div className="nl-badge" title={oreNLPerUser[utente.id].motivo || 'Non Lavorato'}>
                          🔵 NL: {oreNLPerUser[utente.id].ore_nl}h
                        </div>
                      )}
                      
                      {/* ✅ Pulsante Assegna NL (solo admin) */}
                      {editable && (
                        <button 
                          className="btn-assegna-nl"
                          onClick={() => handleOpenNLModal(utente)}
                          title="Assegna ore Non Lavorato"
                        >
                          {oreNLPerUser[utente.id] ? '✏️ Modifica NL' : '➕ Assegna NL'}
                        </button>
                      )}
                    </div>
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map(giorno => {
                    const turno = getTurnoForUserDay(utente.id, giorno);
                    
                    return (
                      <td 
                        key={giorno} 
                        className={`turno-cell ${turno ? getTurnoClass(turno.tipo_turno) : ''} ${editable ? 'editable' : ''}`}
                        onClick={() => editable && onTurnoClick && onTurnoClick(utente.id, giorno, turno)}
                      >
                        {turno ? (
                          turno.tipo_turno === 'OFF' ? (
                            <div className="turno-content">
                              <div className="turno-tipo" style={{ backgroundColor: '#6c757d', color: 'white' }}>
                                OFF
                              </div>
                            </div>
                          ) : (
                            <div className="turno-content">
                              <div className="turno-orario">
                                {formatTime(turno.ora_inizio)} - {formatTime(turno.ora_fine)}
                              </div>
                              <div className="turno-tipo">
                                {turno.tipo_turno}
                              </div>
                              {turno.ore_effettive && (
                                <div className="turno-ore">
                                  {turno.ore_effettive}h
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <div className="turno-empty">
                            {editable ? '+ Aggiungi' : '-'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="week-table-legend">
          <strong>Legenda:</strong>
          <span className="legend-item turno-apertura">Apertura</span>
          <span className="legend-item turno-centrale">Centrale</span>
          <span className="legend-item turno-chiusura">Chiusura</span>
          <span className="legend-item turno-ferie">Ferie</span>
          <span className="legend-item" style={{ background: '#d1ecf1', color: '#0c5460', padding: '5px 12px', borderRadius: '4px' }}>
            🔵 NL = Non Lavorato
          </span>
        </div>
      )}

      <GiornoDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        settimana={settimana}
        giorno={selectedGiornoDetail}
      />

      {/* ✅ Modal Assegna NL */}
      {nlModalOpen && selectedUserForNL && (
        <AssegnaNLModal
          isOpen={nlModalOpen}
          onClose={handleCloseNLModal}
          onSave={handleSaveNL}
          userId={selectedUserForNL.id}
          userName={selectedUserForNL.nome}
          settimana={settimana}
        />
      )}
    </div>
  );
};

export default WeekTable;