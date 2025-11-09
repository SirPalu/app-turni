// Controller per importare preferenze in turni
const { query } = require('../config/database');
const { calcolaOreGiornaliere, generaOrariTurno } = require('../utils/turniHelpers');

/**
 * IMPORTA PREFERENZE IN TURNI
 * POST /api/turni/importa-preferenze
 * Body: { settimana }
 * 
 * Converte le preferenze in turni nella tabella
 */
const importaPreferenze = async (req, res) => {
  try {
    const { settimana } = req.body;

    if (!settimana) {
      return res.status(400).json({ error: 'Parametro settimana obbligatorio' });
    }

    console.log(`📥 Importazione preferenze per settimana ${settimana}`);

    // 1. Carica tutte le preferenze per la settimana
    const prefResult = await query(
      `SELECT p.*, u.ore_settimanali, u.nome
       FROM preferenze p
       JOIN users u ON p.user_id = u.id
       WHERE p.settimana = $1`,
      [settimana]
    );

    if (prefResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Nessuna preferenza trovata per questa settimana' 
      });
    }

    let turniImportati = 0;
    let turniEsistentiSkip = 0;

    // 2. Per ogni preferenza, crea il turno corrispondente
    for (const pref of prefResult.rows) {
      // Verifica se esiste già un turno
      const turnoCheck = await query(
        `SELECT id FROM turni 
         WHERE user_id = $1 AND settimana = $2 AND giorno_settimana = $3`,
        [pref.user_id, settimana, pref.giorno_settimana]
      );

      if (turnoCheck.rows.length > 0) {
        // Turno già esistente, salta
        turnoEsistentiSkip++;
        continue;
      }

      // Determina tipo turno da preferenza
      let tipoTurno = pref.tipo_preferenza; // OFF, APERTURA, CHIUSURA

      if (tipoTurno === 'OFF') {
        // OFF non crea turno, salta
        continue;
      }

      // Calcola orari in base a ore contratto
      const oreGiorno = calcolaOreGiornaliere(pref.ore_settimanali);
      const orari = generaOrariTurno(tipoTurno, oreGiorno);

      // Inserisci turno
      await query(
        `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, settimana, giorno_settimana) DO NOTHING`,
        [
          pref.user_id,
          settimana,
          pref.giorno_settimana,
          orari.inizio + ':00',
          orari.fine + ':00',
          tipoTurno
        ]
      );

      turniImportati++;
      console.log(`  ✓ ${pref.nome}: ${tipoTurno} giorno ${pref.giorno_settimana}`);
    }

    res.json({
      message: 'Preferenze importate con successo',
      turniImportati,
      turniEsistentiSkip,
      totalePreferenze: prefResult.rows.length
    });

  } catch (error) {
    console.error('❌ Errore importazione preferenze:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  importaPreferenze
};