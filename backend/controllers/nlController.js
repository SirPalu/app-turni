// Controller per gestione ore NL (Non Lavorato)
const { query } = require('../config/database');

/**
 * ASSEGNA ORE NL A UN DIPENDENTE
 * POST /api/nl/assegna
 * Body: { user_id, settimana, ore_nl, motivo? }
 */
const assegnaOreNL = async (req, res) => {
  try {
    const { user_id, settimana, ore_nl, motivo } = req.body;

    if (!user_id || !settimana || ore_nl === undefined) {
      return res.status(400).json({ 
        error: 'Campi obbligatori: user_id, settimana, ore_nl' 
      });
    }

    if (ore_nl < 0) {
      return res.status(400).json({ 
        error: 'Le ore NL devono essere maggiori o uguali a 0' 
      });
    }

    // Se ore_nl è 0, elimina il record
    if (ore_nl === 0) {
      await query(
        'DELETE FROM ore_nl_settimana WHERE user_id = $1 AND settimana = $2',
        [user_id, settimana]
      );

      return res.json({
        message: 'Ore NL rimosse con successo',
        ore_nl: null
      });
    }

    // Inserisci o aggiorna
    const result = await query(
      `INSERT INTO ore_nl_settimana (user_id, settimana, ore_nl, motivo, assegnate_da)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, settimana)
       DO UPDATE SET 
         ore_nl = EXCLUDED.ore_nl,
         motivo = EXCLUDED.motivo,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [user_id, settimana, ore_nl, motivo, req.user.userId]
    );

    res.json({
      message: 'Ore NL assegnate con successo',
      ore_nl: result.rows[0]
    });

  } catch (error) {
    console.error('Errore assegnazione NL:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET ORE NL DI UN DIPENDENTE PER UNA SETTIMANA
 * GET /api/nl/:userId/:settimana
 */
const getOreNL = async (req, res) => {
  try {
    const { userId, settimana } = req.params;

    const result = await query(
      `SELECT onl.*, u.nome as assegnate_da_nome
       FROM ore_nl_settimana onl
       LEFT JOIN users u ON onl.assegnate_da = u.id
       WHERE onl.user_id = $1 AND onl.settimana = $2`,
      [userId, settimana]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Nessuna ore NL trovata',
        ore_nl: null
      });
    }

    res.json({
      ore_nl: result.rows[0]
    });

  } catch (error) {
    console.error('Errore recupero ore NL:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET TUTTE LE ORE NL DI UNA SETTIMANA
 * GET /api/nl/settimana/:settimana
 */
const getOreNLSettimana = async (req, res) => {
  try {
    const { settimana } = req.params;

    const result = await query(
      `SELECT onl.*, u.nome as user_nome, u.ore_settimanali
       FROM ore_nl_settimana onl
       JOIN users u ON onl.user_id = u.id
       WHERE onl.settimana = $1
       ORDER BY u.nome`,
      [settimana]
    );

    res.json({
      settimana,
      ore_nl: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Errore recupero ore NL settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * ELIMINA ORE NL ASSEGNATE
 * DELETE /api/nl/:userId/:settimana
 */
const eliminaOreNL = async (req, res) => {
  try {
    const { userId, settimana } = req.params;

    const result = await query(
      'DELETE FROM ore_nl_settimana WHERE user_id = $1 AND settimana = $2 RETURNING *',
      [userId, settimana]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Nessuna ore NL trovata da eliminare' 
      });
    }

    res.json({
      message: 'Ore NL eliminate con successo',
      ore_nl: result.rows[0]
    });

  } catch (error) {
    console.error('Errore eliminazione ore NL:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  assegnaOreNL,
  getOreNL,
  getOreNLSettimana,
  eliminaOreNL
};