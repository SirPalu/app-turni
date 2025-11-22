// Controller per autenticazione (login, logout, verifica token)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token valido per 7 giorni

/**
 * LOGIN
 * POST /api/auth/login
 * Body: { username, password }
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validazione input
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username e password sono obbligatori' 
      });
    }

    // Cerca utente nel database
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Credenziali non valide' 
      });
    }

    const user = result.rows[0];

    // ✅ VERIFICA PASSWORD CON BCRYPT
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Credenziali non valide' 
      });
    }

    // Genera JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        ruolo: user.ruolo
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Risposta con token e dati utente (SENZA password!)
    res.json({
      message: 'Login effettuato con successo',
      token,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        ruolo: user.ruolo,
        ore_settimanali: user.ore_settimanali,
        ha_chiavi: user.ha_chiavi
      }
    });

  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ 
      error: 'Errore interno del server' 
    });
  }
};

/**
 * VERIFICA TOKEN
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
const me = async (req, res) => {
  try {
    // req.user è stato popolato dal middleware auth
    const userId = req.user.userId;

    // Recupera dati aggiornati dal DB
    const result = await query(
      'SELECT id, username, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Utente non trovato' 
      });
    }

    res.json({
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Errore verifica utente:', error);
    res.status(500).json({ 
      error: 'Errore interno del server' 
    });
  }
};

/**
 * LOGOUT
 * POST /api/auth/logout
 * (lato client deve solo cancellare il token)
 */
const logout = async (req, res) => {
  res.json({ 
    message: 'Logout effettuato. Elimina il token dal client.' 
  });
};

module.exports = {
  login,
  me,
  logout
};