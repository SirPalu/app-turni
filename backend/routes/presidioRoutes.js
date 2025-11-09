// Route per configurazione presidio
const express = require('express');
const router = express.Router();
const { getConfigPresidio, updatePresidioGiorno } = require('../controllers/presidioController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/presidio/config/:settimana
 * Ottieni configurazione presidio settimana
 */
router.get('/config/:settimana',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  getConfigPresidio
);

/**
 * PUT /api/presidio/config/:settimana/giorno/:giorno
 * Aggiorna tipo presidio per un giorno
 */
router.put('/config/:settimana/giorno/:giorno',
  authenticateToken,
  authorizeRoles('amministratore'),
  updatePresidioGiorno
);

module.exports = router;