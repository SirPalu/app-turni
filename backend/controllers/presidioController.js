// Controller per gestione configurazione presidio
const { query } = require('../config/database');

/**
 * GET CONFIG PRESIDIO SETTIMANA
 * GET /api/presidio/config/:settimana
 */
const getConfigPresidio = async (req, res) => {
  try {
    const { settimana } = req.params;

    let result = await query(
      'SELECT * FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    // Se non esiste, crea con default
    if (result.rows.length === 0) {
      await query(
        `INSERT INTO config_settimane (settimana) VALUES ($1)`,
        [settimana]
      );
      
      result = await query(
        'SELECT * FROM config_settimane WHERE settimana = $1',
        [settimana]
      );
    }

    const config = result.rows[0];
    
    // Formatta per frontend
    const presidio = {
      0: config.tipo_presidio_lun || 'base',
      1: config.tipo_presidio_mar || 'base',
      2: config.tipo_presidio_mer || 'base',
      3: config.tipo_presidio_gio || 'base',
      4: config.tipo_presidio_ven || 'base',
      5: config.tipo_presidio_sab || 'rinforzato',
      6: config.tipo_presidio_dom || 'rinforzato'
    };

    res.json({
      settimana,
      presidio,
      stato: config.stato || 'pianificazione'
    });

  } catch (error) {
    console.error('Errore get config presidio:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * UPDATE TIPO PRESIDIO GIORNO
 * PUT /api/presidio/config/:settimana/giorno/:giorno
 * Body: { tipo: 'base' | 'rinforzato' }
 */
const updatePresidioGiorno = async (req, res) => {
  try {
    const { settimana, giorno } = req.params;
    const { tipo } = req.body;

    if (!['base', 'rinforzato'].includes(tipo)) {
      return res.status(400).json({ 
        error: 'Tipo presidio deve essere "base" o "rinforzato"' 
      });
    }

    const giornoInt = parseInt(giorno);
    if (giornoInt < 0 || giornoInt > 6) {
      return res.status(400).json({ error: 'Giorno deve essere tra 0 e 6' });
    }

    // Mappa giorno -> colonna
    const colonneGiorni = {
      0: 'tipo_presidio_lun',
      1: 'tipo_presidio_mar',
      2: 'tipo_presidio_mer',
      3: 'tipo_presidio_gio',
      4: 'tipo_presidio_ven',
      5: 'tipo_presidio_sab',
      6: 'tipo_presidio_dom'
    };

    const colonna = colonneGiorni[giornoInt];

    // Verifica se esiste config per settimana
    const check = await query(
      'SELECT id FROM config_settimane WHERE settimana = $1',
      [settimana]
    );

    if (check.rows.length === 0) {
      // Crea con default
      await query(
        'INSERT INTO config_settimane (settimana) VALUES ($1)',
        [settimana]
      );
    }

    // Aggiorna usando template literal sicuro
    const updateQuery = `UPDATE config_settimane SET ${colonna} = $1 WHERE settimana = $2`;
    await query(updateQuery, [tipo, settimana]);

    res.json({
      message: 'Presidio aggiornato',
      giorno: giornoInt,
      tipo
    });

  } catch (error) {
    console.error('Errore update presidio:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getConfigPresidio,
  updatePresidioGiorno
};