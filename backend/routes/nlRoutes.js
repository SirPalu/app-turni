// Route per gestione ore NL (Non Lavorato)
const express = require('express');
const router = express.Router();
const { 
  assegnaOreNL, 
  getOreNL, 
  getOreNLSettimana,
  eliminaOreNL 
} = require('../controllers/nlController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * POST /api/nl/assegna
 * Assegna ore NL a un dipendente per una settimana (solo Admin)
 */
router.post('/assegna',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  assegnaOreNL
);

/**
 * GET /api/nl/:userId/:settimana
 * Ottieni ore NL di un dipendente per una settimana
 */
router.get('/:userId/:settimana',
  authenticateToken,
  getOreNL
);

/**
 * GET /api/nl/settimana/:settimana
 * Ottieni tutte le ore NL di una settimana (per tutti i dipendenti)
 */
router.get('/settimana/:settimana',
  authenticateToken,
  getOreNLSettimana
);

/**
 * DELETE /api/nl/:userId/:settimana
 * Elimina ore NL assegnate (solo Admin)
 */
router.delete('/:userId/:settimana',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  eliminaOreNL
);

module.exports = router;