// Controller per algoritmo auto-pianificazione OTTIMIZZATO
const { query } = require('../config/database');

/**
 * GENERA PIANIFICAZIONE AUTOMATICA CON ALGORITMO RANDOM SEARCH
 * POST /api/algoritmo/genera
 */
const generaPianificazione = async (req, res) => {
  try {
    const { settimana } = req.body;
    
    if (!settimana) {
      return res.status(400).json({ error: 'Parametro settimana obbligatorio' });
    }

    console.log(`🤖 Avvio algoritmo auto-pianificazione per settimana ${settimana}`);

    // 1. Carica dati
    const dipendenti = await caricaDipendenti();
    const turniEsistenti = await caricaTurniEsistenti(settimana);
    const configPresidio = await caricaConfigPresidio(settimana);

    // 2. Calcola slot da riempire
    const slotDaRiempire = calcolaSlotVuoti(dipendenti, turniEsistenti);

    console.log(`📊 ${slotDaRiempire.length} slot da riempire su ${dipendenti.length * 7} totali`);

    // 3. Random Search con ottimizzazione
    const risultato = await eseguiRandomSearch(
      slotDaRiempire,
      dipendenti,
      turniEsistenti,
      configPresidio,
      settimana
    );

    if (!risultato.success) {
      return res.status(400).json({
        error: 'Impossibile trovare pianificazione ottimale',
        dettagli: risultato.motivo,
        migliorScore: risultato.bestScore
      });
    }

    res.json({
      message: 'Pianificazione generata con successo',
      turniGenerati: risultato.turniGenerati,
      giorniVerdi: risultato.giorniVerdi,
      score: risultato.score,
      tentativiEffettuati: risultato.tentativiEffettuati,
      statistiche: {
        ore_medie: 0,
        dipendenti_pianificati: dipendenti.length
      }
    });

  } catch (error) {
    console.error('❌ Errore algoritmo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * CARICA DIPENDENTI (escluso manager)
 */
const caricaDipendenti = async () => {
  const result = await query(
    `SELECT id, nome, ore_settimanali, ha_chiavi 
     FROM users 
     WHERE ruolo != 'manager'
     ORDER BY nome`
  );
  return result.rows;
};

/**
 * CARICA TURNI ESISTENTI (locked, non modificabili)
 */
const caricaTurniEsistenti = async (settimana) => {
  const result = await query(
    `SELECT * FROM turni WHERE settimana = $1`,
    [settimana]
  );
  return result.rows;
};

/**
 * CARICA CONFIG PRESIDIO
 */
const caricaConfigPresidio = async (settimana) => {
  const result = await query(
    `SELECT * FROM config_settimane WHERE settimana = $1`,
    [settimana]
  );

  if (result.rows.length === 0) {
    return {
      0: 'base', 1: 'base', 2: 'base', 3: 'base', 4: 'base',
      5: 'rinforzato', 6: 'rinforzato'
    };
  }

  const config = result.rows[0];
  return {
    0: config.tipo_presidio_lun || 'base',
    1: config.tipo_presidio_mar || 'base',
    2: config.tipo_presidio_mer || 'base',
    3: config.tipo_presidio_gio || 'base',
    4: config.tipo_presidio_ven || 'base',
    5: config.tipo_presidio_sab || 'rinforzato',
    6: config.tipo_presidio_dom || 'rinforzato'
  };
};

/**
 * CALCOLA SLOT VUOTI DA RIEMPIRE
 */
const calcolaSlotVuoti = (dipendenti, turniEsistenti) => {
  const slots = [];

  dipendenti.forEach(dip => {
    const turniDip = turniEsistenti.filter(t => t.user_id === dip.id);
    
    const giorniOccupati = {};
    const conteggioTipi = {
      OFF: 0,
      APERTURA: 0,
      CHIUSURA: 0,
      CENTRALE: 0,
      'CENTRALE-A': 0,
      'CENTRALE-B': 0,
      FERIE: 0,
      MALATTIA: 0
    };

    turniDip.forEach(t => {
      giorniOccupati[t.giorno_settimana] = t.tipo_turno;
      if (conteggioTipi[t.tipo_turno] !== undefined) {
        conteggioTipi[t.tipo_turno]++;
      }
    });

    const turniMancanti = {
      OFF: Math.max(0, 2 - conteggioTipi.OFF),
      APERTURA: Math.max(0, 2 - conteggioTipi.APERTURA),
      CHIUSURA: Math.max(0, 2 - conteggioTipi.CHIUSURA),
      CENTRALE: Math.max(0, 1 - (conteggioTipi.CENTRALE + conteggioTipi['CENTRALE-A'] + conteggioTipi['CENTRALE-B']))
    };

    for (let giorno = 0; giorno <= 6; giorno++) {
      if (!giorniOccupati[giorno]) {
        slots.push({
          userId: dip.id,
          userName: dip.nome,
          haChiavi: dip.ha_chiavi,
          oreSettimanali: dip.ore_settimanali,
          giorno,
          turniMancanti: { ...turniMancanti }
        });
      }
    }
  });

  return slots;
};

/**
 * RANDOM SEARCH: Esegue N tentativi e salva il migliore
 */
const eseguiRandomSearch = async (slotDaRiempire, dipendenti, turniEsistenti, configPresidio, settimana) => {
  const MAX_TENTATIVI = 20000;
  let bestSolution = null;
  let bestScore = -Infinity;
  let tentativiValidi = 0;

  console.log(`🔄 Inizio Random Search (${MAX_TENTATIVI} tentativi)...`);

  for (let tentativo = 0; tentativo < MAX_TENTATIVI; tentativo++) {
    const pianificazione = generaPianificazioneRandom(slotDaRiempire, dipendenti);

    if (!validaVincoli(pianificazione, dipendenti)) {
      continue;
    }

    tentativiValidi++;

    const score = await calcolaScore(pianificazione, turniEsistenti, configPresidio, settimana);

    if (score.totale > bestScore) {
      bestScore = score.totale;
      bestSolution = {
        turni: pianificazione,
        score: score
      };

      console.log(`✨ Nuovo best: Score ${bestScore} (${score.giorniVerdi}/7 verdi) - Tentativo ${tentativo + 1}`);
    }

    if (score.giorniVerdi === 7) {
      console.log(`🎯 Soluzione perfetta trovata al tentativo ${tentativo + 1}!`);
      break;
    }
  }

  if (!bestSolution) {
    return {
      success: false,
      motivo: 'Nessuna pianificazione valida trovata nei tentativi disponibili',
      bestScore: bestScore
    };
  }

  // FASE 2: Ottimizzazione locale
  console.log('🎯 Avvio ottimizzazione locale sulla miglior soluzione trovata...');
  const soluzioneOttimizzata = await ottimizzazioneLocale(
    bestSolution.turni,
    dipendenti,
    turniEsistenti,
    configPresidio,
    settimana
  );

  if (soluzioneOttimizzata.score.totale > bestScore) {
    console.log(`🚀 Ottimizzazione ha migliorato lo score da ${bestScore} a ${soluzioneOttimizzata.score.totale}`);
    bestSolution = soluzioneOttimizzata;
    bestScore = soluzioneOttimizzata.score.totale;
  }

  const turniGenerati = await salvaPianificazione(bestSolution.turni, settimana);

  return {
    success: true,
    turniGenerati,
    giorniVerdi: bestSolution.score.giorniVerdi,
    score: bestScore,
    tentativiEffettuati: tentativiValidi
  };
};

/**
 * OTTIMIZZAZIONE LOCALE: Prova swap tra dipendenti
 */
const ottimizzazioneLocale = async (pianificazione, dipendenti, turniEsistenti, configPresidio, settimana) => {
  console.log('🔧 Inizio ottimizzazione locale...');
  
  let migliorato = true;
  let iterazioni = 0;
  const MAX_ITERAZIONI = 50;
  
  let currentSolution = [...pianificazione];
  let currentScore = await calcolaScore(currentSolution, turniEsistenti, configPresidio, settimana);
  
  while (migliorato && iterazioni < MAX_ITERAZIONI) {
    migliorato = false;
    iterazioni++;
    
    for (let i = 0; i < currentSolution.length; i++) {
      for (let j = i + 1; j < currentSolution.length; j++) {
        const turno1 = currentSolution[i];
        const turno2 = currentSolution[j];
        
        if (turno1.tipo_turno === turno2.tipo_turno && turno1.user_id !== turno2.user_id) {
          const nuovaSolution = [...currentSolution];
          [nuovaSolution[i], nuovaSolution[j]] = [nuovaSolution[j], nuovaSolution[i]];
          
          nuovaSolution[i] = { ...nuovaSolution[i], user_id: turno1.user_id };
          nuovaSolution[j] = { ...nuovaSolution[j], user_id: turno2.user_id };
          
          if (!validaVincoli(nuovaSolution, dipendenti)) continue;
          
          const nuovoScore = await calcolaScore(nuovaSolution, turniEsistenti, configPresidio, settimana);
          
          if (nuovoScore.totale > currentScore.totale) {
            currentSolution = nuovaSolution;
            currentScore = nuovoScore;
            migliorato = true;
            console.log(`✨ Swap migliorativo: Score ${nuovoScore.totale} (${nuovoScore.giorniVerdi}/7 verdi)`);
            break;
          }
        }
      }
      
      if (migliorato) break;
    }
  }
  
  console.log(`🎯 Ottimizzazione completata dopo ${iterazioni} iterazioni`);
  
  return {
    turni: currentSolution,
    score: currentScore
  };
};

/**
 * GENERA PIANIFICAZIONE RANDOM
 */
const generaPianificazioneRandom = (slotDaRiempire, dipendenti) => {
  const pianificazione = [];
  const slotPerDipendente = {};
  
  slotDaRiempire.forEach(slot => {
    if (!slotPerDipendente[slot.userId]) {
      slotPerDipendente[slot.userId] = [];
    }
    slotPerDipendente[slot.userId].push(slot);
  });

  Object.entries(slotPerDipendente).forEach(([userId, slots]) => {
    if (slots.length === 0) return;

    const turniMancanti = { ...slots[0].turniMancanti };
    const giorniDisponibili = slots.map(s => s.giorno);

    const poolTurni = [];
    for (let i = 0; i < turniMancanti.OFF; i++) poolTurni.push('OFF');
    for (let i = 0; i < turniMancanti.APERTURA; i++) poolTurni.push('APERTURA');
    for (let i = 0; i < turniMancanti.CHIUSURA; i++) poolTurni.push('CHIUSURA');
    for (let i = 0; i < turniMancanti.CENTRALE; i++) poolTurni.push('CENTRALE');

    shuffleArray(poolTurni);

    giorniDisponibili.forEach((giorno, idx) => {
      if (idx < poolTurni.length) {
        pianificazione.push({
          user_id: parseInt(userId),
          userName: slots[0].userName,
          haChiavi: slots[0].haChiavi,
          oreSettimanali: slots[0].oreSettimanali,
          giorno_settimana: giorno,
          tipo_turno: poolTurni[idx]
        });
      }
    });
  });

  return pianificazione;
};

/**
 * VALIDA VINCOLI HARD
 */
const validaVincoli = (pianificazione, dipendenti) => {
  const turniPerDipendente = {};
  
  pianificazione.forEach(t => {
    if (!turniPerDipendente[t.user_id]) {
      turniPerDipendente[t.user_id] = [];
    }
    turniPerDipendente[t.user_id].push(t.tipo_turno);
  });

  for (const [userId, turni] of Object.entries(turniPerDipendente)) {
    const count = {
      OFF: turni.filter(t => t === 'OFF').length,
      APERTURA: turni.filter(t => t === 'APERTURA').length,
      CHIUSURA: turni.filter(t => t === 'CHIUSURA').length,
      CENTRALE: turni.filter(t => ['CENTRALE', 'CENTRALE-A', 'CENTRALE-B'].includes(t)).length
    };

    if (count.OFF > 2 || count.APERTURA > 2 || count.CHIUSURA > 2 || count.CENTRALE > 1) {
      return false;
    }
  }

  return true;
};

/**
 * CALCOLA SCORE DELLA PIANIFICAZIONE
 */
const calcolaScore = async (pianificazione, turniEsistenti, configPresidio, settimana) => {
  const tuttiTurni = [...turniEsistenti, ...pianificazione];
  let giorniVerdi = 0;
  const dettaglioGiorni = {};

  for (let giorno = 0; giorno <= 6; giorno++) {
    const turniGiorno = tuttiTurni.filter(t => t.giorno_settimana === giorno && t.tipo_turno !== 'OFF');
    const tipoPresidio = configPresidio[giorno];

    const presidioOk = await verificaPresidioGiorno(turniGiorno, tipoPresidio, giorno);

    dettaglioGiorni[giorno] = {
      turni: turniGiorno.length,
      presidioOk
    };

    if (presidioOk) {
      giorniVerdi++;
    }
  }

  const scoreTotale = giorniVerdi * 10 + tuttiTurni.length * 0.1;

  return {
    totale: scoreTotale,
    giorniVerdi,
    dettaglio: dettaglioGiorni
  };
};

/**
 * VERIFICA PRESIDIO GIORNO
 */
const verificaPresidioGiorno = async (turniGiorno, tipoPresidio, giorno) => {
  if (turniGiorno.length === 0) return false;

  const turniApertura = turniGiorno.filter(t => t.tipo_turno === 'APERTURA');
  const turniChiusura = turniGiorno.filter(t => t.tipo_turno === 'CHIUSURA');

  const haChiaviApertura = turniApertura.some(t => t.haChiavi || t.ha_chiavi);
  const haChiaviChiusura = turniChiusura.some(t => t.haChiavi || t.ha_chiavi);

  if (!haChiaviApertura || !haChiaviChiusura) {
    return false;
  }

  const fasce = calcolaCoperturaFasce(turniGiorno);

  if (tipoPresidio === 'base') {
    const mattina = fasce['10:00'] >= 2 && fasce['13:00'] >= 2;
    const pomeriggio = fasce['14:00'] >= 3 && fasce['18:00'] >= 3;
    const sera = fasce['19:00'] >= 2 && fasce['21:00'] >= 2;
    return mattina && pomeriggio && sera;
  } else {
    const mattina = fasce['10:00'] >= 2;
    const giorno = fasce['12:00'] >= 3 && fasce['15:00'] >= 3 && fasce['18:00'] >= 3;
    const sera = fasce['20:00'] >= 2 && fasce['21:00'] >= 2;
    return mattina && giorno && sera;
  }
};

/**
 * CALCOLA COPERTURA FASCE ORARIE
 */
const calcolaCoperturaFasce = (turniGiorno) => {
  const copertura = {};
  const oreCritiche = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '18:00', '19:00', '20:00', '21:00'];

  oreCritiche.forEach(ora => {
    const [h, m] = ora.split(':').map(Number);
    const minuti = h * 60 + m;

    let presenze = 0;
    turniGiorno.forEach(turno => {
      const oraInizio = turno.ora_inizio || getOrarioTurno(turno.tipo_turno, turno.oreSettimanali, turno.giorno_settimana).inizio;
      const oraFine = turno.ora_fine || getOrarioTurno(turno.tipo_turno, turno.oreSettimanali, turno.giorno_settimana).fine;

      const [hInizio] = oraInizio.substring(0, 5).split(':').map(Number);
      const [hFine] = oraFine.substring(0, 5).split(':').map(Number);
      const minInizio = hInizio * 60;
      const minFine = hFine * 60;

      if (minuti >= minInizio && minuti < minFine) {
        presenze++;
      }
    });

    copertura[ora] = presenze;
  });

  return copertura;
};

/**
 * GET ORARIO TURNO
 */
const getOrarioTurno = (tipoTurno, oreSettimanali, giorno) => {
  const conPausa = oreSettimanali >= 30;
  const oraApertura = (giorno === 1 || giorno === 3) ? '09:00' : '09:30';
  const oreGiorno = calcolaOreGiornaliere(oreSettimanali);

  const orari = {
    APERTURA: {
      5: { inizio: oraApertura, fine: conPausa ? '15:00' : '14:30' },
      6: { inizio: oraApertura, fine: conPausa ? '16:00' : '15:30' },
      7: { inizio: oraApertura, fine: conPausa ? '17:00' : '16:30' },
      8: { inizio: oraApertura, fine: conPausa ? '18:00' : '17:30' }
    },
    'CENTRALE': {
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

const calcolaOreGiornaliere = (oreSettimanali) => {
  const oreGiorno = oreSettimanali / 5;
  if (oreGiorno >= 7.5) return 8;
  if (oreGiorno >= 6.5) return 7;
  if (oreGiorno >= 5.5) return 6;
  return 5;
};

/**
 * SALVA PIANIFICAZIONE NEL DATABASE
 */
const salvaPianificazione = async (turni, settimana) => {
  let salvati = 0;

  for (const turno of turni) {
    const orari = getOrarioTurno(turno.tipo_turno, turno.oreSettimanali, turno.giorno_settimana);

    let oreEffettive = null;
    if (turno.tipo_turno === 'OFF') {
      oreEffettive = 0;
    }

    await query(
      `INSERT INTO turni (user_id, settimana, giorno_settimana, ora_inizio, ora_fine, tipo_turno, ore_effettive)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, settimana, giorno_settimana) DO NOTHING`,
      [
        turno.user_id,
        settimana,
        turno.giorno_settimana,
        orari.inizio + ':00',
        orari.fine + ':00',
        turno.tipo_turno,
        oreEffettive
      ]
    );

    salvati++;
  }

  return salvati;
};

/**
 * SHUFFLE ARRAY (Fisher-Yates)
 */
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

module.exports = {
  generaPianificazione
};