// Route per gestione utenti
const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const { 
  authenticateToken, 
  authorizeRoles, 
  authorizeOwnerOrAdmin 
} = require('../middleware/auth');

/**
 * GET /api/users
 * Lista tutti gli utenti (solo Manager/Admin)
 */
router.get('/', 
  authenticateToken, 
  authorizeRoles('manager', 'amministratore'), 
  getAllUsers
);

/**
 * GET /api/users/:id
 * Dettaglio singolo utente (proprietario o Manager/Admin)
 */
router.get('/:id', 
  authenticateToken, 
  authorizeOwnerOrAdmin, 
  getUserById
);

/**
 * POST /api/users
 * Crea nuovo utente (solo Manager)
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles('manager'), 
  createUser
);

/**
 * PUT /api/users/:id
 * Aggiorna utente (solo Manager)
 */
router.put('/:id', 
  authenticateToken, 
  authorizeRoles('manager'), 
  updateUser
);

/**
 * DELETE /api/users/:id
 * Elimina utente (solo Manager)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles('manager'), 
  deleteUser
);

module.exports = router;