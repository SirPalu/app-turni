// Route per gestione turni e preferenze
const express = require('express');
const router = express.Router();
const {
  getTurniSettimana,
  getTurniUtente,
  createOrUpdateTurno,
  deleteTurno,
  getPreferenze,
  savePreferenze,
  resetSettimana
} = require('../controllers/turniController');

const { importaPreferenze } = require('../controllers/importaPreferenzeController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ===== TURNI =====

/**
 * GET /api/turni/settimana/:data
 * Visualizza tutti i turni di una settimana
 */
router.get('/settimana/:data', 
  authenticateToken, 
  getTurniSettimana
);

/**
 * GET /api/turni/user/:userId/settimana/:data
 * Visualizza turni di un utente specifico
 */
router.get('/user/:userId/settimana/:data', 
  authenticateToken, 
  getTurniUtente
);

/**
 * POST /api/turni
 * Crea o aggiorna un turno (solo Amministratore)
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles('amministratore', 'manager'), 
  createOrUpdateTurno
);

/**
 * DELETE /api/turni/:id
 * Elimina un turno (solo Amministratore)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles('amministratore', 'manager'), 
  deleteTurno
);

/**
 * DELETE /api/turni/reset-settimana/:data
 * Resetta tutti i turni di una settimana
 */
router.delete('/reset-settimana/:data',
  authenticateToken,
  authorizeRoles('amministratore'),
  resetSettimana
);

// ===== PREFERENZE =====

/**
 * GET /api/turni/preferenze/:userId/settimana/:data
 * Visualizza preferenze di un utente
 */
router.get('/preferenze/:userId/settimana/:data', 
  authenticateToken, 
  getPreferenze
);

/**
 * POST /api/turni/preferenze
 * Salva preferenze utente
 */
router.post('/preferenze', 
  authenticateToken, 
  savePreferenze
);

/**
 * POST /api/turni/importa-preferenze
 * Importa preferenze in turni (solo Amministratore)
 */
router.post('/importa-preferenze',
  authenticateToken,
  authorizeRoles('amministratore'),
  importaPreferenze
);

module.exports = router;