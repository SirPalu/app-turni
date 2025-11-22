// Route per export Excel
const express = require('express');
const router = express.Router();
const { exportSettimanaExcel } = require('../controllers/exportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/export/settimana/:data
 * Scarica Excel settimana (solo Admin/Manager)
 */
router.get('/settimana/:data',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  exportSettimanaExcel
);

module.exports = router;