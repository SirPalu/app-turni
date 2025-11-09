// Route per validazioni
const express = require('express');
const router = express.Router();
const { getValidazioniSettimana } = require('../controllers/validazioniController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/validazioni/settimana/:data
 * Validazioni complete settimana (solo Admin/Manager)
 */
router.get('/settimana/:data', 
  authenticateToken, 
  authorizeRoles('amministratore', 'manager'),
  getValidazioniSettimana
);

module.exports = router;