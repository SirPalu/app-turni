// Middleware per proteggere route e verificare permessi
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Middleware: verifica che la richiesta abbia un token JWT valido
 * Aggiunge req.user con i dati dell'utente decodificati
 */
const authenticateToken = (req, res, next) => {
  // Leggi token dall'header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ 
      error: 'Accesso negato. Token mancante.' 
    });
  }

  try {
    // Verifica e decodifica token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, username, ruolo }
    next(); // Procedi alla route successiva
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token scaduto. Effettua nuovamente il login.' 
      });
    }
    return res.status(403).json({ 
      error: 'Token non valido.' 
    });
  }
};

/**
 * Middleware: verifica che l'utente abbia uno dei ruoli specificati
 * Uso: authorizeRoles('manager', 'amministratore')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Autenticazione richiesta.' 
      });
    }

    if (!allowedRoles.includes(req.user.ruolo)) {
      return res.status(403).json({ 
        error: `Accesso negato. Permesso richiesto: ${allowedRoles.join(' o ')}` 
      });
    }

    next();
  };
};

/**
 * Middleware: verifica che l'utente stia accedendo ai propri dati
 * oppure che sia un amministratore/manager
 */
const authorizeOwnerOrAdmin = (req, res, next) => {
  const requestedUserId = parseInt(req.params.userId || req.params.id);
  const currentUserId = req.user.userId;
  const currentUserRole = req.user.ruolo;

  // Amministratore e manager possono vedere tutto
  if (currentUserRole === 'amministratore' || currentUserRole === 'manager') {
    return next();
  }

  // Dipendente può vedere solo i propri dati
  if (requestedUserId === currentUserId) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Accesso negato. Puoi visualizzare solo i tuoi dati.' 
  });
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeOwnerOrAdmin
};