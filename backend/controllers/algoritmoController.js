// Controller per algoritmo auto-pianificazione
const { query } = require('../config/database');

// Orari standard per tipo turno
const ORARI_STANDARD = {
  APERTURA: { inizio: '09:30:00', fine: '17:30:00', ore: 8 },
  CENTRALE: { inizio: '12:00:00', fine: '20:00:00', ore: 8 },
  CHIUSURA: { inizio: '14:00:00', fine: '22:00:00', ore: 8 }
};

/**
 * GENERA PIANIFICAZIONE AUTOMATICA
 * POST /api/algoritmo/genera
 * Body: { settimana, config: { presidio: { 0: 'base', 1: 'base', ... } } }
 */
const generaPianificazione = async (req, res) => {
  try {
    const { settimana, config } = req.body;
    
    if (!settimana) {
      return res.status(400).json({ error: 'Parametro settimana obbligatorio' });
    }

    console.log(`🤖 Avvio algoritmo per settimana ${settimana}`);

    // 1. Carica dati necessari
    const utenti = await caricaUtenti();
    const preferenze = await caricaPreferenze(settimana);
    const configPresidio = config?.presidio || generaConfigPresidioDefault();

    // 2. Inizializza strutture dati
    const pianificazione = inizializzaPianificazione(utenti);
    
    // 3. Algoritmo principale
    const risultato = await eseguiAlgoritmo(
      utenti, 
      preferenze, 
      configPresidio, 
      pianificazione,
      settimana
    );

    if (!risultato.success) {
      return res.status(400).json({ 
        error: 'Impossibile generare pianificazione',
        dettagli: risultato.motivo
      });
    }

    res.json({
      message: 'Pianificazione generata con successo',
      turniGenerati: risultato.turniGenerati,
      statistiche: risultato.statistiche
    });

  } catch (error) {
    console.error('❌ Errore algoritmo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * CARICA UTENTI (escluso manager)
 */
const caricaUtenti = async () => {
  const result = await query(
    `SELECT id, nome, ore_settimanali, ha_chiavi 
     FROM users 
     WHERE ruolo != 'manager'
     ORDER BY nome`
  );
  return result.rows;
};

/**
 * CARICA PREFERENZE SETTIMANA
 */
const caricaPreferenze = async (settimana) => {
  const result = await query(
    `SELECT user_id, giorno_settimana, tipo_preferenza
     FROM preferenze
     WHERE settimana = $1`,
    [settimana]
  );
  
  // Mappa per accesso veloce
  const mappa = {};
  result.rows.forEach(pref => {
    const key = `${pref.user_id}_${pref.giorno_settimana}`;
    mappa[key] = pref.tipo_preferenza;
  });
  
  return mappa;
};

/**
 * GENERA CONFIG PRESIDIO DEFAULT
 */
const generaConfigPresidioDefault = () => {
  return {
    0: 'base', 1: 'base', 2: 'base', 3: 'base', 4: 'base',
    5: 'rinforzato', // Sabato
    6: 'rinforzato'  // Domenica
  };
};

/**
 * INIZIALIZZA STRUTTURA PIANIFICAZIONE
 */
const inizializzaPianificazione = (utenti) => {
  const piano = {};
  utenti.forEach(u => {
    piano[u.id] = {
      turni: [], // Array di {giorno, tipo, ore}
      ore_totali: 0,
      off_count: 7, // Parte da 7, diminuisce con ogni turno
      chiusure_count: 0,
      aperture_count: 0
    };
  });
  return piano;
};

/**
 * ALGORITMO PRINCIPALE
 */
const eseguiAlgoritmo = async (utenti, preferenze, configPresidio, pianificazione, settimana) => {
  console.log('📊 Utenti:', utenti.length);
  console.log('🎯 Preferenze:', Object.keys(preferenze).length);

  const turniGenerati = [];

  // FASE 1: Assegna OFF rispettando preferenze
  console.log('📍 FASE 1: Assegna OFF');
  for (const utente of utenti) {
    const offAssegnati = assegnaOFF(utente, preferenze, pianificazione);
    console.log(`  ${utente.nome}: ${offAssegnati.length} OFF assegnati`);
  }

  // FASE 2: Assegna turni giorno per giorno
  console.log('📍 FASE 2: Assegna turni giornalieri');
  for (let giorno = 0; giorno <= 6; giorno++) {
    const tipoPresidio = configPresidio[giorno];
    const turniGiorno = await assegnaTurniGiorno(
      giorno, 
      tipoPresidio, 
      utenti, 
      preferenze, 
      pianificazione
    );
    
    turniGenerati.push(...turniGiorno);
    console.log(`  Giorno ${giorno}: ${turniGiorno.length} turni assegnati`);
  }

  // FASE 3: Salva turni nel database
  console.log('📍 FASE 3: Salva turni nel database');
  for (const turno of turniGenerati) {
    await query(
      `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, settimana, giorno_settimana) DO NOTHING`,
      [turno.user_id, settimana, turno.giorno_settimana, turno.ora_inizio, turno.ora_fine, turno.tipo_turno]
    );
  }

  // Calcola statistiche
  const statistiche = calcolaStatistiche(pianificazione, utenti);

  return {
    success: true,
    turniGenerati: turniGenerati.length,
    statistiche
  };
};

/**
 * ASSEGNA OFF PER UN DIPENDENTE
 */
const assegnaOFF = (utente, preferenze, pianificazione) => {
  const offAssegnati = [];
  
  // Cerca se ha richiesto OFF
  for (let giorno = 0; giorno <= 6; giorno++) {
    const key = `${utente.id}_${giorno}`;
    if (preferenze[key] === 'OFF') {
      pianificazione[utente.id].turni.push({ giorno, tipo: 'OFF' });
      offAssegnati.push(giorno);
      // Non diminuire off_count qui, viene già inizializzato a 7
    }
  }

  // Se ha meno di 2 OFF, assegnane altri random
  if (offAssegnati.length < 2) {
    const giorniDisponibili = [];
    for (let g = 0; g <= 6; g++) {
      if (!offAssegnati.includes(g)) {
        giorniDisponibili.push(g);
      }
    }
    
    // Assegna OFF random fino a 2
    while (offAssegnati.length < 2 && giorniDisponibili.length > 0) {
      const idx = Math.floor(Math.random() * giorniDisponibili.length);
      const giornoOff = giorniDisponibili.splice(idx, 1)[0];
      pianificazione[utente.id].turni.push({ giorno: giornoOff, tipo: 'OFF' });
      offAssegnati.push(giornoOff);
    }
  }

  return offAssegnati;
};

/**
 * ASSEGNA TURNI PER UN GIORNO
 */
const assegnaTurniGiorno = async (giorno, tipoPresidio, utenti, preferenze, pianificazione) => {
  const turni = [];
  
  // Determina quante persone servono
  const reqPresidio = tipoPresidio === 'rinforzato' ? 3 : 3; // Semplificato: 3 persone
  
  // Filtra utenti disponibili (non in OFF)
  const disponibili = utenti.filter(u => {
    const turniUtente = pianificazione[u.id].turni;
    return !turniUtente.some(t => t.giorno === giorno && t.tipo === 'OFF');
  });

  console.log(`    Giorno ${giorno}: ${disponibili.length} dipendenti disponibili`);

  // Ordina per priorità (chi ha meno ore lavorate ha priorità)
  disponibili.sort((a, b) => {
    const oreA = pianificazione[a.id].ore_totali;
    const oreB = pianificazione[b.id].ore_totali;
    return oreA - oreB;
  });

  // Assegna turni
  let assegnati = 0;
  const tipiDaAssegnare = ['APERTURA', 'CENTRALE', 'CHIUSURA'];
  
  for (const tipo of tipiDaAssegnare) {
    if (assegnati >= reqPresidio) break;
    
    // Trova candidato migliore per questo tipo
    const candidato = trovaCandidatoMigliore(
      tipo, 
      giorno, 
      disponibili, 
      preferenze, 
      pianificazione
    );

    if (candidato) {
      const orari = ORARI_STANDARD[tipo];
      
      turni.push({
        user_id: candidato.id,
        giorno_settimana: giorno,
        ora_inizio: orari.inizio,
        ora_fine: orari.fine,
        tipo_turno: tipo
      });

      // Aggiorna pianificazione
      pianificazione[candidato.id].turni.push({ 
        giorno, 
        tipo, 
        ore: orari.ore 
      });
      pianificazione[candidato.id].ore_totali += orari.ore;
      pianificazione[candidato.id].off_count--;
      
      if (tipo === 'CHIUSURA') pianificazione[candidato.id].chiusure_count++;
      if (tipo === 'APERTURA') pianificazione[candidato.id].aperture_count++;

      // Rimuovi dai disponibili
      const idx = disponibili.findIndex(u => u.id === candidato.id);
      if (idx > -1) disponibili.splice(idx, 1);
      
      assegnati++;
    }
  }

  return turni;
};

/**
 * TROVA CANDIDATO MIGLIORE PER UN TIPO DI TURNO
 */
const trovaCandidatoMigliore = (tipo, giorno, disponibili, preferenze, pianificazione) => {
  let migliore = null;
  let migliorScore = -Infinity;

  for (const utente of disponibili) {
    let score = 0;
    
    // VINCOLO: Chiavi obbligatorie per apertura/chiusura
    if ((tipo === 'APERTURA' || tipo === 'CHIUSURA') && !utente.ha_chiavi) {
      continue; // Skip
    }

    // VINCOLO: Max 2 chiusure
    if (tipo === 'CHIUSURA' && pianificazione[utente.id].chiusure_count >= 2) {
      continue; // Skip
    }

    // BONUS: Rispetta preferenza (peso alto)
    const key = `${utente.id}_${giorno}`;
    if (preferenze[key] === tipo) {
      score += 100;
    }

    // BONUS: Ha poche ore (equità)
    const oreTarget = utente.ore_settimanali;
    const oreAttuali = pianificazione[utente.id].ore_totali;
    const diffOre = oreTarget - oreAttuali;
    score += diffOre * 2;

    // BONUS: Ha pochi turni di questo tipo (equità)
    if (tipo === 'CHIUSURA') {
      score += (2 - pianificazione[utente.id].chiusure_count) * 10;
    }

    if (score > migliorScore) {
      migliorScore = score;
      migliore = utente;
    }
  }

  return migliore;
};

/**
 * CALCOLA STATISTICHE FINALI
 */
const calcolaStatistiche = (pianificazione, utenti) => {
  const stats = {
    dipendenti_pianificati: 0,
    ore_medie: 0,
    preferenze_rispettate: 0
  };

  let totaleOre = 0;
  for (const utente of utenti) {
    const piano = pianificazione[utente.id];
    if (piano.turni.length > 0) {
      stats.dipendenti_pianificati++;
      totaleOre += piano.ore_totali;
    }
  }

  stats.ore_medie = (totaleOre / stats.dipendenti_pianificati).toFixed(1);

  return stats;
};

module.exports = {
  generaPianificazione
};