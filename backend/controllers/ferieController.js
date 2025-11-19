// Controller per gestione richieste ferie
const { query } = require('../config/database');

/**
 * CREATE RICHIESTA FERIE (Dipendente)
 * POST /api/ferie/richiesta
 * Body: { user_id, date: ['2025-06-15', '2025-06-16', ...] }
 */
const creaRichiestaFerie = async (req, res) => {
  try {
    const { user_id, date } = req.body;

    if (!user_id || !date || !Array.isArray(date) || date.length === 0) {
      return res.status(400).json({ 
        error: 'Campi obbligatori: user_id, date (array di date)' 
      });
    }

    // Verifica che tutte le date siano future (dal domani in poi)
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const domani = new Date(oggi);
    domani.setDate(oggi.getDate() + 1);
    
    const seiMesiDopo = new Date(domani);
    seiMesiDopo.setMonth(domani.getMonth() + 6);

    const dateNonValide = date.filter(d => {
      const dataRichiesta = new Date(d);
      return dataRichiesta < domani || dataRichiesta > seiMesiDopo;
    });

    if (dateNonValide.length > 0) {
      return res.status(400).json({ 
        error: 'Le date devono essere tra domani e 6 mesi nel futuro',
        date_non_valide: dateNonValide
      });
    }

    // Inserisci ogni data come richiesta separata
    const richiesteInserite = [];
    const richiesteEsistenti = [];

    for (const data of date) {
      try {
        const result = await query(
          `INSERT INTO richieste_ferie (user_id, data_richiesta, tipo_approvazione)
           VALUES ($1, $2, 'in_attesa')
           RETURNING *`,
          [user_id, data]
        );
        richiesteInserite.push(result.rows[0]);
      } catch (err) {
        // Violazione constraint UNIQUE = già richiesta
        if (err.code === '23505') {
          richiesteEsistenti.push(data);
        } else {
          throw err;
        }
      }
    }

    res.status(201).json({
      message: 'Richiesta ferie inviata',
      richieste_inserite: richiesteInserite.length,
      richieste_gia_esistenti: richiesteEsistenti.length,
      date_duplicate: richiesteEsistenti
    });

  } catch (error) {
    console.error('Errore creazione richiesta ferie:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET RICHIESTE FERIE DIPENDENTE
 * GET /api/ferie/mie/:userId?stato=in_attesa
 */
const getRichiesteDipendente = async (req, res) => {
  try {
    const { userId } = req.params;
    const { stato } = req.query;

    let queryText = `
      SELECT rf.*, u.nome as dipendente_nome, a.nome as admin_nome
      FROM richieste_ferie rf
      JOIN users u ON rf.user_id = u.id
      LEFT JOIN users a ON rf.gestita_da = a.id
      WHERE rf.user_id = $1
    `;
    const params = [userId];

    if (stato) {
      queryText += ` AND rf.tipo_approvazione = $2`;
      params.push(stato);
    }

    queryText += ` ORDER BY rf.data_richiesta ASC`;

    const result = await query(queryText, params);

    res.json({
      userId: parseInt(userId),
      richieste: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Errore recupero richieste dipendente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET TUTTE LE RICHIESTE (Admin)
 * GET /api/ferie/tutte?stato=in_attesa&userId=5
 */
const getTutteRichieste = async (req, res) => {
  try {
    const { stato, userId } = req.query;

    let queryText = `
      SELECT rf.*, u.nome as dipendente_nome, u.ore_settimanali, a.nome as admin_nome
      FROM richieste_ferie rf
      JOIN users u ON rf.user_id = u.id
      LEFT JOIN users a ON rf.gestita_da = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (stato) {
      queryText += ` AND rf.tipo_approvazione = $${paramCount}`;
      params.push(stato);
      paramCount++;
    }

    if (userId) {
      queryText += ` AND rf.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    // Ordina per data richiesta (più vicine prima)
    queryText += ` ORDER BY rf.data_richiesta ASC`;

    const result = await query(queryText, params);

    // Conta richieste in attesa per badge notifica
    const countInAttesa = await query(
      `SELECT COUNT(*) as count FROM richieste_ferie WHERE tipo_approvazione = 'in_attesa'`
    );

    res.json({
      richieste: result.rows,
      count: result.rows.length,
      in_attesa_count: parseInt(countInAttesa.rows[0].count)
    });

  } catch (error) {
    console.error('Errore recupero tutte richieste:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GESTISCI RICHIESTA FERIE (Admin)
 * PUT /api/ferie/gestisci/:id
 * Body: { azione: 'approva' | 'rifiuta' | 'converti_off', note_admin? }
 */
const gestisciRichiesta = async (req, res) => {
  try {
    const { id } = req.params;
    const { azione, note_admin } = req.body;

    if (!['approva', 'rifiuta', 'converti_off'].includes(azione)) {
      return res.status(400).json({ 
        error: 'Azione non valida. Usare: approva, rifiuta, converti_off' 
      });
    }

    // Mappa azione -> tipo_approvazione
    const statoMap = {
      approva: 'approvata',
      rifiuta: 'rifiutata',
      converti_off: 'off_approvato'
    };

    const nuovoStato = statoMap[azione];

    const result = await query(
      `UPDATE richieste_ferie 
       SET tipo_approvazione = $1, 
           note_admin = $2, 
           gestita_da = $3, 
           gestita_il = CURRENT_TIMESTAMP,
           visualizzata_da_dipendente = FALSE
       WHERE id = $4
       RETURNING *`,
      [nuovoStato, note_admin, req.user.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }

    res.json({
      message: `Richiesta ${azione === 'approva' ? 'approvata' : azione === 'rifiuta' ? 'rifiutata' : 'convertita in OFF'}`,
      richiesta: result.rows[0]
    });

  } catch (error) {
    console.error('Errore gestione richiesta:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * SEGNA COME VISUALIZZATA (Dipendente)
 * PUT /api/ferie/visualizza/:id
 */
const segnaVisualizzata = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE richieste_ferie 
       SET visualizzata_da_dipendente = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata o non autorizzato' });
    }

    res.json({
      message: 'Richiesta segnata come visualizzata',
      richiesta: result.rows[0]
    });

  } catch (error) {
    console.error('Errore aggiornamento visualizzazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * ELIMINA RICHIESTA (Dipendente - solo se in attesa)
 * DELETE /api/ferie/richiesta/:id
 */
const eliminaRichiesta = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM richieste_ferie 
       WHERE id = $1 AND user_id = $2 AND tipo_approvazione = 'in_attesa'
       RETURNING *`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Richiesta non trovata, non autorizzato, o già gestita' 
      });
    }

    res.json({
      message: 'Richiesta eliminata',
      richiesta: result.rows[0]
    });

  } catch (error) {
    console.error('Errore eliminazione richiesta:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  creaRichiestaFerie,
  getRichiesteDipendente,
  getTutteRichieste,
  gestisciRichiesta,
  segnaVisualizzata,
  eliminaRichiesta
};