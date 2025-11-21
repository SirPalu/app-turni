// Controller per workflow autorizzazione settimane
const { query } = require('../config/database');

/**
 * GET STATO SETTIMANA
 * GET /api/authorization/stato/:settimana
 */
const getStatoSettimana = async (req, res) => {
  try {
    const { settimana } = req.params;

    const result = await query(
      `SELECT 
        stato,
        pubblicata_il,
        pubblicata_da,
        confermata_il,
        confermata_da,
        autorizzata_il,
        autorizzata_da,
        rifiutata_il,
        rifiutata_da,
        note_rifiuto,
        u1.nome as pubblicata_da_nome,
        u2.nome as confermata_da_nome,
        u3.nome as autorizzata_da_nome,
        u4.nome as rifiutata_da_nome
       FROM config_settimane cs
       LEFT JOIN users u1 ON cs.pubblicata_da = u1.id
       LEFT JOIN users u2 ON cs.confermata_da = u2.id
       LEFT JOIN users u3 ON cs.autorizzata_da = u3.id
       LEFT JOIN users u4 ON cs.rifiutata_da = u4.id
       WHERE settimana = $1`,
      [settimana]
    );

    if (result.rows.length === 0) {
      // Settimana non esiste ancora, crea con stato pianificazione
      await query(
        'INSERT INTO config_settimane (settimana, stato) VALUES ($1, $2)',
        [settimana, 'pianificazione']
      );

      return res.json({
        settimana,
        stato: 'pianificazione',
        pubblicata_il: null,
        confermata_il: null,
        autorizzata_il: null,
        rifiutata_il: null,
        note_rifiuto: null
      });
    }

    res.json({
      settimana,
      ...result.rows[0]
    });

  } catch (error) {
    console.error('Errore get stato settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * PUBBLICA BOZZA
 * POST /api/authorization/pubblica
 * Body: { settimana }
 */
const pubblicaBozza = async (req, res) => {
  try {
    const { settimana } = req.body;
    const adminId = req.user.userId;

    // Verifica stato attuale
    const check = await query(
      'SELECT stato FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settimana non trovata' });
    }

    const statoAttuale = check.rows[0].stato;

    if (statoAttuale !== 'pianificazione') {
      return res.status(400).json({ 
        error: `Impossibile pubblicare: stato attuale è "${statoAttuale}"` 
      });
    }

    // Aggiorna a bozza
    await query(
      `UPDATE config_settimane 
       SET stato = 'bozza',
           pubblicata_il = CURRENT_TIMESTAMP,
           pubblicata_da = $1
       WHERE settimana = $2`,
      [adminId, settimana]
    );

    res.json({
      message: 'Bozza pubblicata con successo',
      settimana,
      nuovo_stato: 'bozza'
    });

  } catch (error) {
    console.error('Errore pubblicazione bozza:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * CONFERMA SETTIMANA
 * POST /api/authorization/conferma
 * Body: { settimana }
 */
const confermaSettimana = async (req, res) => {
  try {
    const { settimana } = req.body;
    const adminId = req.user.userId;

    // Verifica stato attuale
    const check = await query(
      'SELECT stato FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settimana non trovata' });
    }

    const statoAttuale = check.rows[0].stato;

    if (statoAttuale !== 'bozza' && statoAttuale !== 'rifiutata') {
      return res.status(400).json({ 
        error: `Impossibile confermare: stato attuale è "${statoAttuale}"` 
      });
    }

    // Verifica scadenza (sabato 19:59)
    const lunedi = new Date(settimana);
    const sabato = new Date(lunedi);
    sabato.setDate(lunedi.getDate() + 5); // Sabato
    sabato.setHours(19, 59, 59, 999);

    const ora = new Date();
    let warning = null;

    if (ora > sabato) {
      warning = 'Attenzione: scadenza (sabato 19:59) superata!';
    }

    // Aggiorna a confermata
    await query(
      `UPDATE config_settimane 
       SET stato = 'confermata',
           confermata_il = CURRENT_TIMESTAMP,
           confermata_da = $1,
           note_rifiuto = NULL
       WHERE settimana = $2`,
      [adminId, settimana]
    );

    res.json({
      message: 'Settimana confermata con successo',
      settimana,
      nuovo_stato: 'confermata',
      warning
    });

  } catch (error) {
    console.error('Errore conferma settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * AUTORIZZA SETTIMANA (Manager)
 * POST /api/authorization/autorizza
 * Body: { settimana }
 */
const autorizzaSettimana = async (req, res) => {
  try {
    const { settimana } = req.body;
    const managerId = req.user.userId;

    // Verifica stato attuale
    const check = await query(
      'SELECT stato FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settimana non trovata' });
    }

    const statoAttuale = check.rows[0].stato;

    if (statoAttuale !== 'confermata') {
      return res.status(400).json({ 
        error: `Impossibile autorizzare: stato attuale è "${statoAttuale}"` 
      });
    }

    // Aggiorna a autorizzata
    await query(
      `UPDATE config_settimane 
       SET stato = 'autorizzata',
           autorizzata_il = CURRENT_TIMESTAMP,
           autorizzata_da = $1
       WHERE settimana = $2`,
      [managerId, settimana]
    );

    res.json({
      message: 'Settimana autorizzata con successo',
      settimana,
      nuovo_stato: 'autorizzata'
    });

  } catch (error) {
    console.error('Errore autorizzazione settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * RIFIUTA PIANIFICAZIONE (Manager)
 * POST /api/authorization/rifiuta
 * Body: { settimana, note_rifiuto }
 */
const rifiutaPianificazione = async (req, res) => {
  try {
    const { settimana, note_rifiuto } = req.body;
    const managerId = req.user.userId;

    if (!note_rifiuto || !note_rifiuto.trim()) {
      return res.status(400).json({ 
        error: 'Le note di rifiuto sono obbligatorie' 
      });
    }

    // Verifica stato attuale
    const check = await query(
      'SELECT stato FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settimana non trovata' });
    }

    const statoAttuale = check.rows[0].stato;

    if (statoAttuale !== 'confermata') {
      return res.status(400).json({ 
        error: `Impossibile rifiutare: stato attuale è "${statoAttuale}"` 
      });
    }

    // Aggiorna a rifiutata
    await query(
      `UPDATE config_settimane 
       SET stato = 'rifiutata',
           rifiutata_il = CURRENT_TIMESTAMP,
           rifiutata_da = $1,
           note_rifiuto = $2
       WHERE settimana = $3`,
      [managerId, note_rifiuto, settimana]
    );

    res.json({
      message: 'Pianificazione rifiutata',
      settimana,
      nuovo_stato: 'rifiutata',
      note_rifiuto
    });

  } catch (error) {
    console.error('Errore rifiuto pianificazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * VERIFICA SCADENZA PREFERENZE
 * GET /api/authorization/check-scadenza-preferenze/:settimana
 */
const checkScadenzaPreferenze = async (req, res) => {
  try {
    const { settimana } = req.params;

    // Calcola mercoledì 21:59 della settimana PRECEDENTE
    const lunediTarget = new Date(settimana + 'T00:00:00');
    const mercolediPrecedente = new Date(lunediTarget);
    mercolediPrecedente.setDate(lunediTarget.getDate() - 5); // Mercoledì prima
    mercolediPrecedente.setHours(21, 59, 59, 999);

    const ora = new Date();
    const scaduta = ora > mercolediPrecedente;

    res.json({
      settimana,
      scadenza: mercolediPrecedente.toISOString(),
      scaduta,
      message: scaduta 
        ? 'Scadenza preferenze superata' 
        : 'Preferenze ancora modificabili'
    });

  } catch (error) {
    console.error('Errore check scadenza:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getStatoSettimana,
  pubblicaBozza,
  confermaSettimana,
  autorizzaSettimana,
  rifiutaPianificazione,
  checkScadenzaPreferenze
};