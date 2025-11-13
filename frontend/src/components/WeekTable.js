// Componente Tabella Turni Settimanali
import React, { useState, useEffect } from 'react';
import { getTurniSettimana, getAllUsers } from '../api/axios';
import './WeekTable.css';
import GiornoDetailModal from './GiornoDetailModal';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const WeekTable = ({ settimana, editable = false, onTurnoClick }) => {
  const [turni, setTurni] = useState({});
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedGiornoDetail, setSelectedGiornoDetail] = useState(null);

  useEffect(() => {
    loadTurni();
  }, [settimana]);

  const loadTurni = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // SEMPRE carica i turni
      const turniResponse = await getTurniSettimana(settimana);
      const turniData = turniResponse.data.turni;
      setTurni(turniData);
      
      // DIFFERENZIA: Admin vs Dipendente
      if (editable) {
        // SE ADMIN/EDITABLE: carica SEMPRE tutti gli utenti
        try {
          const usersResponse = await getAllUsers();
          // Filtra manager
          const filteredUsers = usersResponse.data.users.filter(u => u.ruolo !== 'manager');
          setUtenti(filteredUsers);
        } catch (err) {
          console.error('Errore caricamento utenti (admin):', err);
          setError('Impossibile caricare la lista utenti');
        }
      } else {
        // SE DIPENDENTE: estrai utenti solo dai turni
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

  // Trova turno per utente e giorno
  const getTurnoForUserDay = (userId, giorno) => {
    const turniGiorno = turni[giorno] || [];
    return turniGiorno.find(t => t.user_id === userId);
  };

  // Formatta orario
  const formatTime = (time) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  // Determina colore in base al tipo turno
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
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setSelectedGiornoDetail(idx);
            setDetailModalOpen(true);
          }}
          title="Clicca per vedere il dettaglio del presidio"
        >
          <div className="giorno-nome">
            {giorno} 
            <span style={{ fontSize: '12px', opacity: 0.8, marginLeft: '5px' }}>🔍</span>
          </div>
          <div className="giorno-data">
            {new Date(new Date(settimana).getTime() + idx * 86400000)
              .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
          </div>
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
                    <strong>{utente.nome}</strong>
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
        </div>
      )}
       {/* Modal Dettaglio Giorno */}
      <GiornoDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        settimana={settimana}
        giorno={selectedGiornoDetail}
      />
    </div>
  );
};

export default WeekTable;