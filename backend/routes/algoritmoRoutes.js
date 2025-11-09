// Route per algoritmo auto-pianificazione
const express = require('express');
const router = express.Router();
const { generaPianificazione } = require('../controllers/algoritmoController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * POST /api/algoritmo/genera
 * Genera pianificazione automatica (solo Amministratore)
 */
router.post('/genera', 
  authenticateToken, 
  authorizeRoles('amministratore'),
  generaPianificazione
);

module.exports = router;