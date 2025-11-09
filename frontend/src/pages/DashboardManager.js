// Dashboard Manager - Completa
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, createUser, updateUser, deleteUser } from '../api/axios';
import './Dashboard.css';
import './DashboardManager.css';

const DashboardManager = () => {
  const { user, logout } = useAuth();
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
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
      password: '', // Non mostrare password esistente
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
        // Modifica
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password; // Non inviare password vuota
        }
        delete updateData.username; // Username non modificabile
        
        await updateUser(editingUser.id, updateData);
        setMessage('Utente modificato con successo');
      } else {
        // Creazione
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
            <span className="info-badge">👥 Gestione Utenti</span>
          </div>
        </div>
        <div className="header-right">
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default DashboardManager;