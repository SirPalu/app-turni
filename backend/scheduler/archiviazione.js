// Scheduler per archiviazione automatica settimana passata - CON NL
const cron = require('node-cron');
const { query } = require('../config/database');

/**
 * ✅ CALCOLA CONTATORI DIPENDENTE CON NL
 */
const calcolaContatoriDipendente = async (userId, settimana) => {
  const result = await query(
    `SELECT * FROM turni WHERE user_id = $1 AND settimana = $2`,
    [userId, settimana]
  );

  const turni = result.rows;
  
  let ore_lavorate = 0;
  let ore_nl = 0;
  let giorni_off = 0;
  let chiusure = 0;
  let aperture = 0;
  let pfes = 0;
  let fes = 0;

  turni.forEach(turno => {
    if (turno.tipo_turno === 'OFF') {
      giorni_off++;
      return;
    }

    if (turno.ore_effettive) {
      const ore = parseFloat(turno.ore_effettive);
      
      if (turno.tipo_turno === 'NL') {
        ore_nl += ore;
      } else {
        ore_lavorate += ore;
      }
    }
    
    if (turno.tipo_turno === 'CHIUSURA') chiusure++;
    if (turno.tipo_turno === 'APERTURA') aperture++;
    
    if (turno.giorno_settimana === 5 && turno.tipo_turno !== 'OFF') pfes++;
    if (turno.giorno_settimana === 6 && turno.tipo_turno !== 'OFF') fes++;
  });

  return {
    ore_lavorate: ore_lavorate.toFixed(1),
    ore_nl: ore_nl.toFixed(1),
    giorni_off,
    aperture,
    chiusure,
    pfes,
    fes
  };
};

/**
 * Archivia settimana passata e aggiorna storico contatori
 */
const archiviaSettimanaPrecedente = async () => {
  try {
    console.log('🔄 Inizio archiviazione settimana passata...');

    const oggi = new Date();
    const lunediCorrente = new Date(oggi);
    lunediCorrente.setDate(oggi.getDate() - (oggi.getDay() === 0 ? 6 : oggi.getDay() - 1));
    lunediCorrente.setHours(0, 0, 0, 0);

    const lunediPassato = new Date(lunediCorrente);
    lunediPassato.setDate(lunediCorrente.getDate() - 7);

    const settimanaPassata = lunediPassato.toISOString().split('T')[0];

    console.log(`📅 Archiviazione settimana: ${settimanaPassata}`);

    // Verifica se la settimana è già stata archiviata
    const checkStorico = await query(
      'SELECT id FROM storico_contatori WHERE settimana = $1 LIMIT 1',
      [settimanaPassata]
    );

    if (checkStorico.rows.length > 0) {
      console.log('⚠️ Settimana già archiviata, skip.');
      return;
    }

    // Ottieni tutti i dipendenti (escluso manager)
    const usersResult = await query(
      "SELECT id, ore_settimanali FROM users WHERE ruolo != 'manager'"
    );

    let contatoriArchiviati = 0;

    // Per ogni dipendente, calcola contatori e inserisci nello storico
    for (const user of usersResult.rows) {
      const contatori = await calcolaContatoriDipendente(user.id, settimanaPassata);

      // ✅ Inserisci nello storico con ore_nl
      await query(
        `INSERT INTO storico_contatori (
          user_id, settimana, ore_lavorate, ore_da_contratto, ore_nl,
          giorni_off, turni_apertura, turni_chiusura, giorni_pfes, giorni_fes,
          storicizzata, storicizzata_il
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, CURRENT_TIMESTAMP)`,
        [
          user.id,
          settimanaPassata,
          contatori.ore_lavorate,
          user.ore_settimanali,
          contatori.ore_nl,
          contatori.giorni_off,
          contatori.aperture,
          contatori.chiusure,
          contatori.pfes,
          contatori.fes
        ]
      );

      contatoriArchiviati++;
    }

    // Marca la settimana come storicizzata
    await query(
      `UPDATE config_settimane 
       SET stato = 'storicizzata', approvata_il = CURRENT_TIMESTAMP 
       WHERE settimana = $1`,
      [settimanaPassata]
    );

    console.log(`✅ Archiviazione completata! ${contatoriArchiviati} dipendenti archiviati.`);

  } catch (error) {
    console.error('❌ Errore archiviazione:', error);
  }
};

/**
 * Avvia scheduler
 */
const avviaScheduler = () => {
  cron.schedule('59 23 * * 0', () => {
    console.log('⏰ Scheduler archiviazione attivato');
    archiviaSettimanaPrecedente();
  }, {
    timezone: "Europe/Rome"
  });

  console.log('📅 Scheduler archiviazione attivo (domenica 23:59)');
};

/**
 * Funzione manuale per test
 */
const archiviaManualmente = async (settimana) => {
  console.log(`🔧 Archiviazione manuale settimana: ${settimana}`);
  
  const usersResult = await query(
    "SELECT id, ore_settimanali FROM users WHERE ruolo != 'manager'"
  );

  for (const user of usersResult.rows) {
    const contatori = await calcolaContatoriDipendente(user.id, settimana);

    await query(
      `INSERT INTO storico_contatori (
        user_id, settimana, ore_lavorate, ore_da_contratto, ore_nl,
        giorni_off, turni_apertura, turni_chiusura, giorni_pfes, giorni_fes,
        storicizzata, storicizzata_il
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, settimana) DO UPDATE SET
        ore_lavorate = EXCLUDED.ore_lavorate,
        ore_nl = EXCLUDED.ore_nl,
        turni_apertura = EXCLUDED.turni_apertura,
        turni_chiusura = EXCLUDED.turni_chiusura,
        giorni_pfes = EXCLUDED.giorni_pfes,
        giorni_fes = EXCLUDED.giorni_fes,
        storicizzata_il = CURRENT_TIMESTAMP`,
      [
        user.id,
        settimana,
        contatori.ore_lavorate,
        user.ore_settimanali,
        contatori.ore_nl,
        contatori.giorni_off,
        contatori.aperture,
        contatori.chiusure,
        contatori.pfes,
        contatori.fes
      ]
    );
  }

  await query(
    `UPDATE config_settimane 
     SET stato = 'storicizzata', approvata_il = CURRENT_TIMESTAMP 
     WHERE settimana = $1`,
    [settimana]
  );

  console.log('✅ Archiviazione manuale completata');
};

module.exports = {
  avviaScheduler,
  archiviaSettimanaPrecedente,
  archiviaManualmente
};