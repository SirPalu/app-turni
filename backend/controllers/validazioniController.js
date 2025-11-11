// Controller per validazioni e contatori
const { query } = require('../config/database');

/**
 * CALCOLA CONTATORI DIPENDENTE
 * Ritorna statistiche per un dipendente in una settimana
 */
const calcolaContatoriDipendente = async (userId, settimana) => {
  const result = await query(
    `SELECT * FROM turni WHERE user_id = $1 AND settimana = $2`,
    [userId, settimana]
  );

  const turni = result.rows;
  
  let ore_lavorate = 0;
  let giorni_off = 0; // Conta gli OFF espliciti
  let chiusure = 0;
  let aperture = 0;
  let pfes = 0; // Sabati
  let fes = 0;  // Domeniche

  turni.forEach(turno => {
    if (turno.tipo_turno === 'OFF') {
      giorni_off++;
      return; // Non conta ore per OFF
    }

    if (turno.ore_effettive) {
      ore_lavorate += parseFloat(turno.ore_effettive);
    }
    
    if (turno.tipo_turno === 'CHIUSURA') chiusure++;
    if (turno.tipo_turno === 'APERTURA') aperture++;
    
    // Sabato = giorno 5, Domenica = giorno 6
    if (turno.giorno_settimana === 5) pfes++;
    if (turno.giorno_settimana === 6) fes++;
  });

  return {
    ore_lavorate: ore_lavorate.toFixed(1),
    giorni_off,
    chiusure,
    aperture,
    pfes,
    fes,
    turni_totali: turni.length
  };
};

/**
 * VALIDA DIPENDENTE
 * Verifica vincoli per un singolo dipendente
 */
const validaDipendente = async (userId, settimana) => {
  const userResult = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    return { errore: 'Utente non trovato' };
  }

  const user = userResult.rows[0];
  const contatori = await calcolaContatoriDipendente(userId, settimana);
  
  const warnings = [];
  const errori = [];

  // Validazione 1: Deve avere esattamente 2 OFF
  if (contatori.giorni_off < 2) {
    errori.push(`Ha solo ${contatori.giorni_off} giorni OFF (obbligatori 2)`);
  }
  if (contatori.giorni_off > 2) {
    warnings.push(`Ha ${contatori.giorni_off} giorni OFF (standard 2)`);
  }

  // Validazione 2: Max 2 chiusure
  if (contatori.chiusure > 2) {
    warnings.push(`Ha ${contatori.chiusure} chiusure (raccomandato max 2)`);
  }

  // Validazione 3: Ore settimanali
  const ore_previste = user.ore_settimanali;
  const ore_effettive = parseFloat(contatori.ore_lavorate);
  const differenza = Math.abs(ore_effettive - ore_previste);
  
  if (differenza > 4) {
    warnings.push(`Ore lavorate: ${ore_effettive}h (previste: ${ore_previste}h, diff: ${differenza.toFixed(1)}h)`);
  }

  // **FIX VALIDAZIONE 4: Controlla chiavi PER GIORNO, non per utente**
  // Questa validazione ora viene fatta solo nel presidio giornaliero
  // Qui NON mettiamo più errori per singolo dipendente senza chiavi
  // perché un collega potrebbe averle

  return {
    userId,
    nome: user.nome,
    contatori,
    warnings,
    errori,
    stato: errori.length > 0 ? 'errore' : (warnings.length > 0 ? 'warning' : 'ok')
  };
};

/**
 * VALIDA PRESIDIO GIORNALIERO
 * Verifica che ogni ora del giorno abbia abbastanza persone
 * E che ci sia ALMENO UNA persona con chiavi per aperture/chiusure
 */
const validaPresidioGiorno = async (settimana, giorno, tipoPresidio = 'base') => {
  const turniResult = await query(
    `SELECT t.*, u.nome, u.ha_chiavi 
     FROM turni t
     JOIN users u ON t.user_id = u.id
     WHERE t.settimana = $1 AND t.giorno_settimana = $2 AND t.tipo_turno != 'OFF'
     ORDER BY t.ora_inizio`,
    [settimana, giorno]
  );

  const turni = turniResult.rows;
  const problemi = [];

  // **FIX CHIAVI: Verifica che almeno UNA persona con chiavi copra apertura E chiusura**
  const turniApertura = turni.filter(t => t.tipo_turno === 'APERTURA');
  const turniChiusura = turni.filter(t => t.tipo_turno === 'CHIUSURA');
  
  // Controlla se c'è almeno una persona con chiavi in APERTURA (se ci sono aperture)
  if (turniApertura.length > 0) {
    const personaConChiaviApertura = turniApertura.some(t => t.ha_chiavi);
    if (!personaConChiaviApertura) {
      problemi.push('⚠️ Nessun dipendente con chiavi in APERTURA!');
    }
  }
  
  // Controlla se c'è almeno una persona con chiavi in CHIUSURA (se ci sono chiusure)
  if (turniChiusura.length > 0) {
    const personaConChiaviChiusura = turniChiusura.some(t => t.ha_chiavi);
    if (!personaConChiaviChiusura) {
      problemi.push('⚠️ Nessun dipendente con chiavi in CHIUSURA!');
    }
  }

  // Definisci requisiti presidio
  const requisiti = tipoPresidio === 'rinforzato' ? {
    '10:00-11:00': 2,
    '11:00-20:00': 3,
    '20:00-22:00': 2
  } : {
    '10:00-13:30': 2,
    '13:30-18:30': 3,
    '18:30-22:00': 2
  };

  // Calcola copertura oraria (semplificata)
  const copertura = {};
  
  // Ore critiche da controllare
  const oreCritiche = ['10:00', '11:00', '13:30', '14:00', '18:30', '20:00', '21:00'];
  
  oreCritiche.forEach(ora => {
    const [h, m] = ora.split(':').map(Number);
    const minuti = h * 60 + m;
    
    let persone = 0;
    turni.forEach(turno => {
      const [hInizio] = turno.ora_inizio.split(':').map(Number);
      const [hFine] = turno.ora_fine.split(':').map(Number);
      const minInizio = hInizio * 60;
      const minFine = hFine * 60;
      
      if (minuti >= minInizio && minuti < minFine) {
        persone++;
      }
    });
    
    copertura[ora] = persone;
  });

  // Verifica requisiti
  if (tipoPresidio === 'base') {
    if (copertura['10:00'] < 2 || copertura['13:00'] < 2) {
      problemi.push('Presidio insufficiente prima delle 13:30 (min 2 persone)');
    }
    if (copertura['14:00'] < 3 || copertura['18:00'] < 3) {
      problemi.push('Presidio insufficiente 13:30-18:30 (min 3 persone)');
    }
    if (copertura['20:00'] < 2 || copertura['21:00'] < 2) {
      problemi.push('Presidio insufficiente 18:30-22:00 (min 2 persone)');
    }
  } else {
    if (copertura['10:00'] < 2) {
      problemi.push('Presidio insufficiente prima delle 11:00 (min 2 persone)');
    }
    if (copertura['14:00'] < 3 || copertura['18:00'] < 3) {
      problemi.push('Presidio insufficiente 11:00-20:00 (min 3 persone)');
    }
    if (copertura['20:00'] < 2 || copertura['21:00'] < 2) {
      problemi.push('Presidio insufficiente 20:00-22:00 (min 2 persone)');
    }
  }

  return {
    giorno,
    tipoPresidio,
    copertura,
    problemi,
    stato: problemi.length > 0 ? 'errore' : 'ok'
  };
};

/**
 * GET VALIDAZIONI COMPLETE SETTIMANA
 * GET /api/validazioni/settimana/:data
 * Ritorna validazioni complete per tutti i dipendenti e tutti i giorni
 */
const getValidazioniSettimana = async (req, res) => {
  try {
    const { data } = req.params;

    // Ottieni tutti gli utenti (escluso manager)
    const usersResult = await query(
      "SELECT * FROM users WHERE ruolo != 'manager' ORDER BY nome"
    );

    // Validazioni per dipendente
    const validazioniDipendenti = [];
    for (const user of usersResult.rows) {
      const validazione = await validaDipendente(user.id, data);
      validazioniDipendenti.push(validazione);
    }

    // Validazioni presidio (per ora base per infrasettimanali, rinforzato per weekend)
    const validazioniPresidio = [];
    for (let giorno = 0; giorno <= 6; giorno++) {
      const tipoPresidio = (giorno === 5 || giorno === 6) ? 'rinforzato' : 'base';
      const validazione = await validaPresidioGiorno(data, giorno, tipoPresidio);
      validazioniPresidio.push(validazione);
    }

    // Conteggio totale
    const totaleErrori = validazioniDipendenti.filter(v => v.stato === 'errore').length +
                         validazioniPresidio.filter(v => v.stato === 'errore').length;
    const totaleWarnings = validazioniDipendenti.filter(v => v.stato === 'warning').length;

    res.json({
      settimana: data,
      validazioniDipendenti,
      validazioniPresidio,
      riepilogo: {
        errori: totaleErrori,
        warnings: totaleWarnings,
        statoGenerale: totaleErrori > 0 ? 'errore' : (totaleWarnings > 0 ? 'warning' : 'ok')
      }
    });

  } catch (error) {
    console.error('Errore validazioni settimana:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getValidazioniSettimana,
  validaDipendente,
  validaPresidioGiorno,
  calcolaContatoriDipendente
};