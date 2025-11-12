// Scheduler per archiviazione automatica settimana passata
const cron = require('node-cron');
const { query } = require('../config/database');
const { calcolaContatoriDipendente } = require('../controllers/validazioniController');

/**
 * Archivia settimana passata e aggiorna storico contatori
 * Esegue ogni domenica alle 23:59
 */
const archiviaSettimanaPrecedente = async () => {
  try {
    console.log('🔄 Inizio archiviazione settimana passata...');

    // Calcola date
    const oggi = new Date();
    const lunediCorrente = new Date(oggi);
    lunediCorrente.setDate(oggi.getDate() - (oggi.getDay() === 0 ? 6 : oggi.getDay() - 1));
    lunediCorrente.setHours(0, 0, 0, 0);

    const lunediPassato = new Date(lunediCorrente);
    lunediPassato.setDate(lunediCorrente.getDate() - 7);

    const settimanaPassata = lunediPassato.toISOString().split('T')[0];

    console.log(`📅 Archiviazione settimana: ${settimanaPassata}`);

    // 1. Verifica se la settimana è già stata archiviata
    const checkStorico = await query(
      'SELECT id FROM storico_contatori WHERE settimana = $1 LIMIT 1',
      [settimanaPassata]
    );

    if (checkStorico.rows.length > 0) {
      console.log('⚠️ Settimana già archiviata, skip.');
      return;
    }

    // 2. Ottieni tutti i dipendenti (escluso manager)
    const usersResult = await query(
      "SELECT id, ore_settimanali FROM users WHERE ruolo != 'manager'"
    );

    let contatoriArchiviati = 0;

    // 3. Per ogni dipendente, calcola contatori e inserisci nello storico
    for (const user of usersResult.rows) {
      const contatori = await calcolaContatoriDipendente(user.id, settimanaPassata);

      // Inserisci nello storico (somma ai valori esistenti)
      await query(
        `INSERT INTO storico_contatori (
          user_id, settimana, ore_lavorate, ore_da_contratto, 
          giorni_off, turni_apertura, turni_chiusura, giorni_pfes, giorni_fes,
          storicizzata, storicizzata_il
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, CURRENT_TIMESTAMP)`,
        [
          user.id,
          settimanaPassata,
          contatori.ore_lavorate,
          user.ore_settimanali,
          contatori.giorni_off,
          contatori.aperture,
          contatori.chiusure,
          contatori.pfes,
          contatori.fes
        ]
      );

      contatoriArchiviati++;
    }

    // 4. Marca la settimana come storicizzata
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
 * Esegue ogni domenica alle 23:59
 */
const avviaScheduler = () => {
  // Cron: minuto ora giorno mese giorno_settimana
  // 59 23 * * 0 = ogni domenica alle 23:59
  cron.schedule('59 23 * * 0', () => {
    console.log('⏰ Scheduler archiviazione attivato');
    archiviaSettimanaPrecedente();
  }, {
    timezone: "Europe/Rome"
  });

  console.log('📅 Scheduler archiviazione attivo (domenica 23:59)');
};

// Funzione manuale per test
const archiviaManualmente = async (settimana) => {
  console.log(`🔧 Archiviazione manuale settimana: ${settimana}`);
  
  const usersResult = await query(
    "SELECT id, ore_settimanali FROM users WHERE ruolo != 'manager'"
  );

  for (const user of usersResult.rows) {
    const contatori = await calcolaContatoriDipendente(user.id, settimana);

    await query(
      `INSERT INTO storico_contatori (
        user_id, settimana, ore_lavorate, ore_da_contratto, 
        giorni_off, turni_apertura, turni_chiusura, giorni_pfes, giorni_fes,
        storicizzata, storicizzata_il
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, settimana) DO UPDATE SET
        ore_lavorate = EXCLUDED.ore_lavorate,
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