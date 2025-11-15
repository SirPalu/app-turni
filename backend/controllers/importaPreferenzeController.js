// Controller per importare preferenze in turni - FIXED orari mar/gio
const { query } = require('../config/database');

/**
 * Calcola ore giornaliere in base a contratto
 */
const calcolaOreGiornaliere = (oreSettimanali) => {
  const oreGiorno = oreSettimanali / 5;
  if (oreGiorno >= 7.5) return 8;
  if (oreGiorno >= 6.5) return 7;
  if (oreGiorno >= 5.5) return 6;
  return 5;
};

/**
 * ✅ Genera orari turno modulari con pausa pranzo E correzione mar/gio
 */
const generaOrariTurno = (tipoTurno, oreSettimanali, giornoSettimana) => {
  const conPausa = oreSettimanali >= 30;
  const oraApertura = (giornoSettimana === 1 || giornoSettimana === 3) ? '09:00' : '09:30';
  const offsetApertura = (giornoSettimana === 1 || giornoSettimana === 3) ? -0.5 : 0; // -30min per mar/gio
  const oreGiorno = calcolaOreGiornaliere(oreSettimanali);

  // Helper per aggiungere/sottrarre ore
  const aggiungiOre = (orario, offset) => {
    if (offset === 0) return orario;
    const [ore, minuti] = orario.split(':').map(Number);
    const minutiTotali = ore * 60 + minuti + (offset * 60);
    const nuoveOre = Math.floor(minutiTotali / 60);
    const nuoviMinuti = minutiTotali % 60;
    return `${String(nuoveOre).padStart(2, '0')}:${String(nuoviMinuti).padStart(2, '0')}`;
  };

  const orari = {
    APERTURA: {
      5: { inizio: oraApertura, fine: aggiungiOre(conPausa ? '15:00' : '14:30', offsetApertura) },
      6: { inizio: oraApertura, fine: aggiungiOre(conPausa ? '16:00' : '15:30', offsetApertura) },
      7: { inizio: oraApertura, fine: aggiungiOre(conPausa ? '17:00' : '16:30', offsetApertura) },
      8: { inizio: oraApertura, fine: aggiungiOre(conPausa ? '18:00' : '17:30', offsetApertura) }
    },
    CENTRALE: {
      5: { inizio: '13:00', fine: conPausa ? '18:30' : '18:00' },
      6: { inizio: '13:00', fine: conPausa ? '19:30' : '19:00' },
      7: { inizio: '12:00', fine: conPausa ? '19:30' : '19:00' },
      8: { inizio: '12:00', fine: conPausa ? '20:30' : '20:00' }
    },
    'CENTRALE-A': {
      5: { inizio: '12:00', fine: conPausa ? '17:30' : '17:00' },
      6: { inizio: '12:00', fine: conPausa ? '18:30' : '18:00' },
      7: { inizio: '12:00', fine: conPausa ? '19:30' : '19:00' },
      8: { inizio: '11:00', fine: conPausa ? '19:30' : '19:00' }
    },
    'CENTRALE-B': {
      5: { inizio: '14:00', fine: conPausa ? '19:30' : '19:00' },
      6: { inizio: '14:00', fine: conPausa ? '20:30' : '20:00' },
      7: { inizio: '13:00', fine: conPausa ? '20:30' : '20:00' },
      8: { inizio: '13:00', fine: conPausa ? '21:30' : '21:00' }
    },
    CHIUSURA: {
      5: { inizio: conPausa ? '16:30' : '17:00', fine: '22:00' },
      6: { inizio: conPausa ? '15:30' : '16:00', fine: '22:00' },
      7: { inizio: conPausa ? '14:30' : '15:00', fine: '22:00' },
      8: { inizio: conPausa ? '13:30' : '14:00', fine: '22:00' }
    }
  };

  return orari[tipoTurno]?.[oreGiorno] || orari[tipoTurno]?.[8] || { inizio: oraApertura, fine: '17:30' };
};

/**
 * IMPORTA PREFERENZE IN TURNI
 * POST /api/turni/importa-preferenze
 * Body: { settimana }
 */
const importaPreferenze = async (req, res) => {
  try {
    const { settimana } = req.body;

    if (!settimana) {
      return res.status(400).json({ error: 'Parametro settimana obbligatorio' });
    }

    console.log(`📥 Importazione preferenze per settimana ${settimana}`);

    // Carica preferenze con info utente
    const prefResult = await query(
      `SELECT p.*, u.ore_settimanali, u.nome
       FROM preferenze p
       JOIN users u ON p.user_id = u.id
       WHERE p.settimana = $1`,
      [settimana]
    );

    if (prefResult.rows.length === 0) {
      return res.json({
        message: 'Nessuna preferenza da importare',
        turniImportati: 0,
        turniEsistentiSkip: 0,
        totalePreferenze: 0
      });
    }

    let turniImportati = 0;
    let turniEsistentiSkip = 0;

    for (const pref of prefResult.rows) {
      // Verifica se esiste già un turno
      const turnoCheck = await query(
        `SELECT id FROM turni 
         WHERE user_id = $1 AND settimana = $2 AND giorno_settimana = $3`,
        [pref.user_id, settimana, pref.giorno_settimana]
      );

      if (turnoCheck.rows.length > 0) {
        turniEsistentiSkip++;
        continue;
      }

      let tipoTurno = pref.tipo_preferenza;

      // Gestione OFF
      if (tipoTurno === 'OFF') {
        await query(
          `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno, ore_effettive)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, settimana, giorno_settimana) DO NOTHING`,
          [pref.user_id, settimana, pref.giorno_settimana, '00:00:00', '00:00:00', 'OFF', 0]
        );
        turniImportati++;
        console.log(`  ✓ ${pref.nome}: OFF giorno ${pref.giorno_settimana}`);
        continue;
      }

      // ✅ Calcola orari in base a ore contratto E giorno settimana (mar/gio)
      const orari = generaOrariTurno(tipoTurno, pref.ore_settimanali, pref.giorno_settimana);

      // Inserisci turno (il trigger calcola ore_effettive automaticamente)
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
      console.log(`  ✓ ${pref.nome}: ${tipoTurno} giorno ${pref.giorno_settimana} (${orari.inizio}-${orari.fine})`);
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