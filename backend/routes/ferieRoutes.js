// Route per gestione richieste ferie
const express = require('express');
const router = express.Router();
const {
  creaRichiestaFerie,
  getRichiesteDipendente,
  getTutteRichieste,
  gestisciRichiesta,
  segnaVisualizzata,
  eliminaRichiesta
} = require('../controllers/ferieController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * POST /api/ferie/richiesta
 * Crea richiesta ferie (Dipendente)
 */
router.post('/richiesta',
  authenticateToken,
  creaRichiestaFerie
);

/**
 * GET /api/ferie/mie/:userId
 * Ottieni richieste ferie del dipendente
 */
router.get('/mie/:userId',
  authenticateToken,
  getRichiesteDipendente
);

/**
 * GET /api/ferie/tutte
 * Ottieni tutte le richieste (Admin/Manager)
 */
router.get('/tutte',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  getTutteRichieste
);

/**
 * PUT /api/ferie/gestisci/:id
 * Gestisci richiesta (approva/rifiuta/converti) - Admin
 */
router.put('/gestisci/:id',
  authenticateToken,
  authorizeRoles('amministratore', 'manager'),
  gestisciRichiesta
);

/**
 * PUT /api/ferie/visualizza/:id
 * Segna richiesta come visualizzata (Dipendente)
 */
router.put('/visualizza/:id',
  authenticateToken,
  segnaVisualizzata
);

/**
 * DELETE /api/ferie/richiesta/:id
 * Elimina richiesta in attesa (Dipendente)
 */
router.delete('/richiesta/:id',
  authenticateToken,
  eliminaRichiesta
);

module.exports = router;