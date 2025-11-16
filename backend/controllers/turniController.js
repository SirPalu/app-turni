// Controller per gestione turni - CON SUPPORTO NL
const { query } = require('../config/database');

/**
 * GET TURNI SETTIMANA
 */
const getTurniSettimana = async (req, res) => {
  try {
    const { data } = req.params;

    const result = await query(
      `SELECT t.*, u.nome, u.username, u.ore_settimanali
       FROM turni t
       JOIN users u ON t.user_id = u.id 
       WHERE t.settimana = $1 AND u.ruolo != 'manager'
       ORDER BY t.giorno_settimana, t.ora_inizio`,
      [data]
    );

    const turniPerGiorno = {};
    for (let i = 0; i <= 6; i++) {
      turniPerGiorno[i] = [];
    }

    result.rows.forEach(turno => {
      turniPerGiorno[turno.giorno_settimana].push(turno);
    });

    res.json({
      settimana: data,
      turni: turniPerGiorno,
      totali: result.rows.length
    });
  } catch (error) {
    console.error('Errore recupero turni settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET TURNI UTENTE
 */
const getTurniUtente = async (req, res) => {
  try {
    const { userId, data } = req.params;

    const result = await query(
      `SELECT * FROM turni 
       WHERE user_id = $1 AND settimana = $2
       ORDER BY giorno_settimana`,
      [userId, data]
    );

    res.json({
      userId: parseInt(userId),
      settimana: data,
      turni: result.rows
    });
  } catch (error) {
    console.error('Errore recupero turni utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * CREATE/UPDATE TURNO - CON SUPPORTO NL
 */
const createOrUpdateTurno = async (req, res) => {
  try {
    const { user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno, ore_effettive } = req.body;

    // Validazione
    if (!user_id || !settimana || giorno_settimana === undefined || !ora_inizio || !ora_fine || !tipo_turno) {
      return res.status(400).json({ 
        error: 'Campi obbligatori: user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno' 
      });
    }

    // Verifica che utente esista e ottieni ore settimanali
    const userCheck = await query(
      'SELECT id, ore_settimanali FROM users WHERE id = $1', 
      [user_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const oreSettimanali = userCheck.rows[0].ore_settimanali;

    // ✅ Calcola ore_effettive
    let oreEffettiveFinali = null;
    
    if (tipo_turno === 'NL') {
      // NL: usa il valore passato dal frontend
      if (!ore_effettive || ore_effettive <= 0) {
        return res.status(400).json({ error: 'Per il turno NL è necessario specificare le ore' });
      }
      oreEffettiveFinali = ore_effettive;
    } else if (tipo_turno === 'FERIE' || tipo_turno === 'MALATTIA') {
      // FERIE/MALATTIA: formula ore_settimanali / 6
      if (oreSettimanali === 40) {
        oreEffettiveFinali = 8;
      } else {
        oreEffettiveFinali = Math.round((oreSettimanali / 6) * 10) / 10;
      }
    }

    // UPSERT
    let result;
    if (oreEffettiveFinali !== null) {
      // Impostiamo ore_effettive manualmente
      result = await query(
        `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno, ore_effettive)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, settimana, giorno_settimana)
         DO UPDATE SET 
           ora_inizio = EXCLUDED.ora_inizio,
           ora_fine = EXCLUDED.ora_fine,
           tipo_turno = EXCLUDED.tipo_turno,
           ore_effettive = EXCLUDED.ore_effettive,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno, oreEffettiveFinali]
      );
    } else {
      // Il trigger calcola automaticamente
      result = await query(
        `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, settimana, giorno_settimana)
         DO UPDATE SET 
           ora_inizio = EXCLUDED.ora_inizio,
           ora_fine = EXCLUDED.ora_fine,
           tipo_turno = EXCLUDED.tipo_turno,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno]
      );
    }

    res.status(201).json({
      message: 'Turno salvato con successo',
      turno: result.rows[0]
    });
  } catch (error) {
    console.error('Errore salvataggio turno:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * DELETE TURNO
 */
const deleteTurno = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM turni WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno non trovato' });
    }

    res.json({
      message: 'Turno eliminato con successo',
      turno: result.rows[0]
    });
  } catch (error) {
    console.error('Errore eliminazione turno:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET PREFERENZE UTENTE
 */
const getPreferenze = async (req, res) => {
  try {
    const { userId, data } = req.params;

    const result = await query(
      `SELECT * FROM preferenze 
       WHERE user_id = $1 AND settimana = $2
       ORDER BY giorno_settimana`,
      [userId, data]
    );

    res.json({
      userId: parseInt(userId),
      settimana: data,
      preferenze: result.rows
    });
  } catch (error) {
    console.error('Errore recupero preferenze:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * SAVE PREFERENZE
 */
const savePreferenze = async (req, res) => {
  try {
    const { user_id, settimana, preferenze } = req.body;

    if (!user_id || !settimana || !Array.isArray(preferenze)) {
      return res.status(400).json({ 
        error: 'Campi obbligatori: user_id, settimana, preferenze (array)' 
      });
    }

    // Elimina preferenze esistenti per quella settimana
    await query(
      'DELETE FROM preferenze WHERE user_id = $1 AND settimana = $2',
      [user_id, settimana]
    );

    // Inserisci nuove preferenze
    const inserted = [];
    for (const pref of preferenze) {
      const result = await query(
        `INSERT INTO preferenze (user_id, settimana, giorno_settimana, tipo_preferenza)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user_id, settimana, pref.giorno_settimana, pref.tipo_preferenza]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({
      message: 'Preferenze salvate con successo',
      preferenze: inserted
    });
  } catch (error) {
    console.error('Errore salvataggio preferenze:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * DELETE ALL TURNI SETTIMANA
 */
const resetSettimana = async (req, res) => {
  try {
    const { data } = req.params;

    const result = await query(
      'DELETE FROM turni WHERE settimana = $1 RETURNING *',
      [data]
    );

    res.json({
      message: 'Settimana resettata con successo',
      turniEliminati: result.rows.length
    });
  } catch (error) {
    console.error('Errore reset settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getTurniSettimana,
  getTurniUtente,
  createOrUpdateTurno,
  deleteTurno,
  getPreferenze,
  savePreferenze,
  resetSettimana
};