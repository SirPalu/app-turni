// Route per storico contatori
const express = require('express');
const router = express.Router();
const { 
  getStoricoRiassuntivo, 
  getStoricoDettaglioDipendente 
} = require('../controllers/storicoController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/storico/riassuntivo
 * Storico cumulativo (solo Admin/Manager)
 */
router.get('/riassuntivo',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  getStoricoRiassuntivo
);

/**
 * GET /api/storico/dipendente/:userId
 * Dettaglio settimane per dipendente
 */
router.get('/dipendente/:userId',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  getStoricoDettaglioDipendente
);

module.exports = router;