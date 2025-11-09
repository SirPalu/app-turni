// Controller per gestione utenti (CRUD)
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const SALT_ROUNDS = 10;

/**
 * GET ALL USERS
 * GET /api/users
 * Ritorna lista di tutti gli utenti (solo Manager/Admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, nome, ruolo, ore_settimanali, ha_chiavi, 
              ferie_ore_mese, created_at, updated_at 
       FROM users 
       ORDER BY nome ASC`
    );

    res.json({
      count: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('Errore recupero utenti:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET USER BY ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, username, nome, ruolo, ore_settimanali, ha_chiavi, 
              ferie_ore_mese, created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Errore recupero utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * CREATE USER
 * POST /api/users
 * Body: { username, password, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese }
 */
const createUser = async (req, res) => {
  try {
    const { 
      username, 
      password, 
      nome, 
      ruolo, 
      ore_settimanali, 
      ha_chiavi, 
      ferie_ore_mese 
    } = req.body;

    // Validazione
    if (!username || !password || !nome || !ruolo || !ore_settimanali) {
      return res.status(400).json({ 
        error: 'Campi obbligatori: username, password, nome, ruolo, ore_settimanali' 
      });
    }

    // Verifica che username non esista già
    const checkUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (checkUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username già esistente' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Inserisci utente
    const result = await query(
      `INSERT INTO users 
       (username, password_hash, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese`,
      [
        username.toLowerCase(), 
        passwordHash, 
        nome, 
        ruolo, 
        ore_settimanali, 
        ha_chiavi || false, 
        ferie_ore_mese || 0
      ]
    );

    res.status(201).json({
      message: 'Utente creato con successo',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Errore creazione utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * UPDATE USER
 * PUT /api/users/:id
 * Body: { nome?, ore_settimanali?, ha_chiavi?, ferie_ore_mese?, password? }
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ore_settimanali, ha_chiavi, ferie_ore_mese, password } = req.body;

    // Verifica che utente esista
    const checkUser = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Costruisci query dinamica
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramCount++}`);
      values.push(nome);
    }
    if (ore_settimanali !== undefined) {
      updates.push(`ore_settimanali = $${paramCount++}`);
      values.push(ore_settimanali);
    }
    if (ha_chiavi !== undefined) {
      updates.push(`ha_chiavi = $${paramCount++}`);
      values.push(ha_chiavi);
    }
    if (ferie_ore_mese !== undefined) {
      updates.push(`ferie_ore_mese = $${paramCount++}`);
      values.push(ferie_ore_mese);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, username, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese`,
      values
    );

    res.json({
      message: 'Utente aggiornato con successo',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Errore aggiornamento utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * DELETE USER
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica che utente esista
    const checkUser = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Elimina utente (CASCADE elimina anche turni, preferenze, ecc.)
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: `Utente ${checkUser.rows[0].username} eliminato con successo`
    });
  } catch (error) {
    console.error('Errore eliminazione utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};