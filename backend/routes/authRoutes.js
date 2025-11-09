// Route per autenticazione
const express = require('express');
const router = express.Router();
const { login, me, logout } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Login con username e password
 * Body: { username: "roberta", password: "password123" }
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Ottieni dati utente corrente (richiede token)
 * Header: Authorization: Bearer <token>
 */
router.get('/me', authenticateToken, me);

/**
 * POST /api/auth/logout
 * Logout (il client deve cancellare il token)
 */
router.post('/logout', authenticateToken, logout);

module.exports = router;