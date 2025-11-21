// Route per workflow autorizzazione
const express = require('express');
const router = express.Router();
const {
  getStatoSettimana,
  pubblicaBozza,
  confermaSettimana,
  autorizzaSettimana,
  rifiutaPianificazione,
  checkScadenzaPreferenze
} = require('../controllers/authorizationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/authorization/stato/:settimana
 * Ottieni stato settimana (tutti autenticati)
 */
router.get('/stato/:settimana',
  authenticateToken,
  getStatoSettimana
);

/**
 * POST /api/authorization/pubblica
 * Pubblica bozza (solo Admin)
 */
router.post('/pubblica',
  authenticateToken,
  authorizeRoles('amministratore'),
  pubblicaBozza
);

/**
 * POST /api/authorization/conferma
 * Conferma settimana (solo Admin)
 */
router.post('/conferma',
  authenticateToken,
  authorizeRoles('amministratore'),
  confermaSettimana
);

/**
 * POST /api/authorization/autorizza
 * Autorizza settimana (solo Manager)
 */
router.post('/autorizza',
  authenticateToken,
  authorizeRoles('manager'),
  autorizzaSettimana
);

/**
 * POST /api/authorization/rifiuta
 * Rifiuta pianificazione (solo Manager)
 */
router.post('/rifiuta',
  authenticateToken,
  authorizeRoles('manager'),
  rifiutaPianificazione
);

/**
 * GET /api/authorization/check-scadenza-preferenze/:settimana
 * Verifica scadenza preferenze (tutti)
 */
router.get('/check-scadenza-preferenze/:settimana',
  authenticateToken,
  checkScadenzaPreferenze
);

module.exports = router;