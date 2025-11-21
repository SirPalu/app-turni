// Dashboard Manager - Con autorizzazione settimane
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  getStatoSettimana,
  autorizzaSettimana,
  rifiutaPianificazione
} from '../api/axios';
import WeekTable from '../components/WeekTable';
import StatoSettimanaBar from '../components/StatoSettimanaBar';
import StoricoPanel from '../components/StoricoPanel';
import './Dashboard.css';
import './DashboardManager.css';

const DashboardManager = () => {
  const { user, logout } = useAuth();

  // Calcola settimane
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  currentMonday.setHours(0, 0, 0, 0);

  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 7);

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const futureMonday = new Date(nextMonday);
  futureMonday.setDate(nextMonday.getDate() + 7);

  const [viewMode, setViewMode] = useState('utenti'); // 'utenti', 'turni', 'storico'
  const [selectedWeek, setSelectedWeek] = useState(currentMonday.toISOString().split('T')[0]);
  const [statoSettimana, setStatoSettimana] = useState(null);
  
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // Modal rifiuto
  const [modalRifiutoOpen, setModalRifiutoOpen] = useState(false);
  const [noteRifiuto, setNoteRifiuto] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nome: '',
    ruolo: 'dipendente',
    ore_settimanali: 36,
    ha_chiavi: false,
    ferie_ore_mese: 12.6
  });

  useEffect(() => {
    loadUtenti();
  }, []);

  useEffect(() => {
    if (viewMode === 'turni') {
      loadStatoSettimana();
    }
  }, [viewMode, selectedWeek]);

  const loadStatoSettimana = async () => {
    try {
      const response = await getStatoSettimana(selectedWeek);
      setStatoSettimana(response.data);
    } catch (err) {
      console.error('Errore caricamento stato:', err);
    }
  };

  const loadUtenti = async () => {
    try {
      setLoading(true);
      const response = await getAllUsers();
      setUtenti(response.data.users);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
      setError('Errore nel caricamento degli utenti');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      nome: '',
      ruolo: 'dipendente',
      ore_settimanali: 36,
      ha_chiavi: false,
      ferie_ore_mese: 12.6
    });
    setEditingUser(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (utente) => {
    setFormData({
      username: utente.username,
      password: '',
      nome: utente.nome,
      ruolo: utente.ruolo,
      ore_settimanali: utente.ore_settimanali,
      ha_chiavi: utente.ha_chiavi,
      ferie_ore_mese: utente.ferie_ore_mese
    });
    setEditingUser(utente);
    setShowForm(true);
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Sei sicuro di voler eliminare l'utente ${username}?`)) {
      return;
    }

    try {
      await deleteUser(id);
      setMessage(`Utente ${username} eliminato con successo`);
      setTimeout(() => setMessage(null), 3000);
      loadUtenti();
    } catch (err) {
      console.error('Errore eliminazione:', err);
      setError(err.response?.data?.error || 'Errore nell\'eliminazione');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingUser) {
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        delete updateData.username;
        
        await updateUser(editingUser.id, updateData);
        setMessage('Utente modificato con successo');
      } else {
        await createUser(formData);
        setMessage('Utente creato con successo');
      }
      
      setTimeout(() => setMessage(null), 3000);
      resetForm();
      loadUtenti();
    } catch (err) {
      console.error('Errore salvataggio:', err);
      setError(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAutorizza = async () => {
    if (!window.confirm('Autorizzare questa settimana?\n\nLa pianificazione verrà approvata definitivamente.')) {
      return;
    }

    try {
      const response = await autorizzaSettimana(selectedWeek);
      alert('✅ ' + response.data.message);
      loadStatoSettimana();
    } catch (err) {
      alert('❌ Errore: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenRifiuto = () => {
    setNoteRifiuto('');
    setModalRifiutoOpen(true);
  };

  const handleConfirmRifiuto = async () => {
    if (!noteRifiuto.trim()) {
      alert('Inserisci un motivo per il rifiuto');
      return;
    }

    try {
      const response = await rifiutaPianificazione(selectedWeek, noteRifiuto);
      alert('✅ ' + response.data.message);
      setModalRifiutoOpen(false);
      setNoteRifiuto('');
      loadStatoSettimana();
    } catch (err) {
      alert('❌ Errore: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatWeekRange = (mondayDate) => {
    const monday = new Date(mondayDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
  };

  const isSettimanaVisibile = () => {
    if (!statoSettimana) return false;
    // Manager vede solo confermata, autorizzata (e rifiutata per storico)
    return ['confermata', 'autorizzata', 'rifiutata'].includes(statoSettimana.stato);
  };

  const canAuthorize = () => {
    return statoSettimana?.stato === 'confermata';
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard Manager</h1>
          <p className="welcome-text">
            Benvenuto, <strong>{user?.nome}</strong>!
          </p>
          <div className="user-info">
            <span className="info-badge">👔 Manager</span>
            <span className="info-badge">👥 Gestione Utenti & Autorizzazioni</span>
          </div>
        </div>
        <div className="header-right">
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab ${viewMode === 'utenti' ? 'active' : ''}`}
          onClick={() => setViewMode('utenti')}
        >
          👥 Gestione Utenti
        </button>
        <button 
          className={`tab ${viewMode === 'turni' ? 'active' : ''}`}
          onClick={() => setViewMode('turni')}
        >
          📅 Visualizza Turni
        </button>
        <button 
          className={`tab ${viewMode === 'storico' ? 'active' : ''}`}
          onClick={() => setViewMode('storico')}
        >
          📊 Storico Contatori
        </button>
      </div>

      {/* Selettore Settimana (solo per turni) */}
      {viewMode === 'turni' && (
        <div className="week-selector">
          <button 
            className={`week-btn ${selectedWeek === previousMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSelectedWeek(previousMonday.toISOString().split('T')[0])}
          >
            {formatWeekRange(previousMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Passata)</span>
          </button>
          <button 
            className={`week-btn ${selectedWeek === currentMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSelectedWeek(currentMonday.toISOString().split('T')[0])}
          >
            {formatWeekRange(currentMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Corrente)</span>
          </button>
          <button 
            className={`week-btn ${selectedWeek === nextMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSelectedWeek(nextMonday.toISOString().split('T')[0])}
          >
            {formatWeekRange(nextMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Prossima)</span>
          </button>
          <button 
            className={`week-btn ${selectedWeek === futureMonday.toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => setSelectedWeek(futureMonday.toISOString().split('T')[0])}
          >
            {formatWeekRange(futureMonday)}<br/>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>(Futura)</span>
          </button>
        </div>
      )}

      {/* Contenuto */}
      <div className="dashboard-content">
        {/* VIEW GESTIONE UTENTI */}
        {viewMode === 'utenti' && (
          <>
            {/* Actions */}
            <div className="actions-bar">
              <button 
                className="btn-action primary"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? '❌ Chiudi Form' : '➕ Nuovo Utente'}
              </button>
            </div>

            {/* Messages */}
            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            {/* Form Utente */}
            {showForm && (
              <div className="user-form-card">
                <h3>{editingUser ? 'Modifica Utente' : 'Nuovo Utente'}</h3>
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Username *</label>
                      <input
                        type="text"
                        name="username"
                        className="form-control"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={!!editingUser}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Password {!editingUser && '*'}
                        {editingUser && ' (lascia vuoto per non modificare)'}
                      </label>
                      <input
                        type="password"
                        name="password"
                        className="form-control"
                        value={formData.password}
                        onChange={handleInputChange}
                        required={!editingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Nome Completo *</label>
                      <input
                        type="text"
                        name="nome"
                        className="form-control"
                        value={formData.nome}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ruolo *</label>
                      <select
                        name="ruolo"
                        className="form-control"
                        value={formData.ruolo}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="dipendente">Dipendente</option>
                        <option value="amministratore">Amministratore</option>
                        <option value="manager">Manager</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ore Settimanali *</label>
                      <input
                        type="number"
                        name="ore_settimanali"
                        className="form-control"
                        value={formData.ore_settimanali}
                        onChange={handleInputChange}
                        min="1"
                        max="48"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ferie (ore/mese)</label>
                      <input
                        type="number"
                        name="ferie_ore_mese"
                        className="form-control"
                        value={formData.ferie_ore_mese}
                        onChange={handleInputChange}
                        step="0.1"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="ha_chiavi"
                        checked={formData.ha_chiavi}
                        onChange={handleInputChange}
                      />
                      <span>Possiede chiavi negozio</span>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={resetForm}>
                      Annulla
                    </button>
                    <button type="submit" className="btn-save">
                      {editingUser ? 'Salva Modifiche' : 'Crea Utente'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista Utenti */}
            <div className="users-list-card">
              <h3>Utenti Registrati ({utenti.length})</h3>
              
              {loading ? (
                <div className="loading">Caricamento...</div>
              ) : (
                <div className="table-wrapper">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Username</th>
                        <th>Ruolo</th>
                        <th>Ore/Sett</th>
                        <th>Chiavi</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utenti.map(utente => (
                        <tr key={utente.id}>
                          <td><strong>{utente.nome}</strong></td>
                          <td>{utente.username}</td>
                          <td>
                            <span className={`role-badge role-${utente.ruolo}`}>
                              {utente.ruolo}
                            </span>
                          </td>
                          <td>{utente.ore_settimanali}h</td>
                          <td className="text-center">
                            {utente.ha_chiavi ? '🔑' : '❌'}
                          </td>
                          <td className="actions-cell">
                            <button 
                              className="btn-edit"
                              onClick={() => handleEdit(utente)}
                            >
                              ✏️ Modifica
                            </button>
                            <button 
                              className="btn-delete-small"
                              onClick={() => handleDelete(utente.id, utente.username)}
                            >
                              🗑️ Elimina
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW TURNI */}
        {viewMode === 'turni' && (
          <div className="turni-view">
            {/* Barra Stato */}
            <StatoSettimanaBar 
              settimana={selectedWeek}
              onUpdate={loadStatoSettimana}
            />

            {/* Azioni Autorizzazione */}
            {canAuthorize() && (
              <div className="actions-bar">
                <button 
                  className="btn-action primary"
                  onClick={handleAutorizza}
                >
                  ✅ Autorizza Settimana
                </button>
                <button 
                  className="btn-action btn-danger"
                  onClick={handleOpenRifiuto}
                >
                  🔴 Rifiuta Pianificazione
                </button>
              </div>
            )}

            {isSettimanaVisibile() ? (
              <WeekTable 
                settimana={selectedWeek} 
                editable={false}
              />
            ) : (
              <div className="info-card info-warning">
                <h4>⏳ Settimana Non Disponibile</h4>
                <p>
                  Questa settimana non è ancora stata confermata dall'amministratore.
                  Potrai visualizzarla e autorizzarla dopo la conferma.
                </p>
              </div>
            )}

            <div className="info-card">
              <h4>ℹ️ Autorizzazione Settimane</h4>
              <p>
                Come manager, puoi visualizzare le settimane <strong>confermate</strong> dall'amministratore
                e decidere se <strong>autorizzarle</strong> o <strong>rifiutarle</strong> con un messaggio
                di motivazione. Le settimane autorizzate diventano visibili a tutti.
              </p>
            </div>
          </div>
        )}

        {/* VIEW STORICO */}
        {viewMode === 'storico' && <StoricoPanel />}
      </div>

      {/* Modal Rifiuto */}
      {modalRifiutoOpen && (
        <div className="modal-overlay" onClick={() => setModalRifiutoOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔴 Rifiuta Pianificazione</h3>
              <button className="modal-close" onClick={() => setModalRifiutoOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Inserisci il motivo del rifiuto. L'amministratore riceverà questo messaggio
                e potrà apportare le modifiche richieste.
              </p>
              <div className="form-group">
                <label className="form-label">Motivazione Rifiuto *</label>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="es. Troppi turni di chiusura concentrati su alcuni dipendenti..."
                  value={noteRifiuto}
                  onChange={(e) => setNoteRifiuto(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setModalRifiutoOpen(false)}>
                  Annulla
                </button>
                <button 
                  className="btn-save"
                  style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' }}
                  onClick={handleConfirmRifiuto}
                  disabled={!noteRifiuto.trim()}
                >
                  Conferma Rifiuto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardManager;