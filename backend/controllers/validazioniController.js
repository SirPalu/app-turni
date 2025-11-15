// Controller per validazioni e contatori - FIXED per config presidio
const { query } = require('../config/database');

/**
 * CALCOLA CONTATORI DIPENDENTE
 */
const calcolaContatoriDipendente = async (userId, settimana) => {
  const result = await query(
    `SELECT * FROM turni WHERE user_id = $1 AND settimana = $2`,
    [userId, settimana]
  );

  const turni = result.rows;
  
  let ore_lavorate = 0;
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
      ore_lavorate += parseFloat(turno.ore_effettive);
    }
    
    if (turno.tipo_turno === 'CHIUSURA') chiusure++;
    if (turno.tipo_turno === 'APERTURA') aperture++;
    
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
 * ✅ VALIDA PRESIDIO GIORNALIERO CON CONFIG DINAMICO
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

  // Verifica chiavi
  const turniApertura = turni.filter(t => t.tipo_turno === 'APERTURA');
  const turniChiusura = turni.filter(t => t.tipo_turno === 'CHIUSURA');
  
  if (turniApertura.length > 0) {
    const personaConChiaviApertura = turniApertura.some(t => t.ha_chiavi);
    if (!personaConChiaviApertura) {
      problemi.push('⚠️ Nessun dipendente con chiavi in APERTURA!');
    }
  }
  
  if (turniChiusura.length > 0) {
    const personaConChiaviChiusura = turniChiusura.some(t => t.ha_chiavi);
    if (!personaConChiaviChiusura) {
      problemi.push('⚠️ Nessun dipendente con chiavi in CHIUSURA!');
    }
  }

  // Calcola copertura oraria
  const fasce = calcolaCoperturaFasce(turni);

  // ✅ VALIDAZIONE BASATA SUL TIPO PRESIDIO
  if (tipoPresidio === 'base') {
    // PRESIDIO BASE: 10-13:30 (min 2), 13:30-18:30 (min 3), 18:30-22 (min 2)
    if (fasce['10:00'] < 2 || fasce['13:00'] < 2) {
      problemi.push('Presidio insufficiente 10:00-13:30 (min 2 persone)');
    }
    if (fasce['14:00'] < 3 || fasce['18:00'] < 3) {
      problemi.push('Presidio insufficiente 13:30-18:30 (min 3 persone)');
    }
    if (fasce['19:00'] < 2 || fasce['21:00'] < 2) {
      problemi.push('Presidio insufficiente 18:30-22:00 (min 2 persone)');
    }
  } else {
    // PRESIDIO RINFORZATO: 10-11 (min 2), 11-20 (min 3), 20-22 (min 2)
    if (fasce['10:00'] < 2) {
      problemi.push('Presidio insufficiente 10:00-11:00 (min 2 persone)');
    }
    if (fasce['12:00'] < 3 || fasce['15:00'] < 3 || fasce['18:00'] < 3) {
      problemi.push('Presidio insufficiente 11:00-20:00 (min 3 persone)');
    }
    if (fasce['20:00'] < 2 || fasce['21:00'] < 2) {
      problemi.push('Presidio insufficiente 20:00-22:00 (min 2 persone)');
    }
  }

  return {
    giorno,
    tipoPresidio,
    copertura: fasce,
    problemi,
    stato: problemi.length > 0 ? 'errore' : 'ok'
  };
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
 * ✅ GET VALIDAZIONI COMPLETE SETTIMANA CON CONFIG PRESIDIO
 */
const getValidazioniSettimana = async (req, res) => {
  try {
    const { data } = req.params;

    // ✅ CARICA CONFIG PRESIDIO DAL DB
    const configResult = await query(
      'SELECT * FROM config_settimane WHERE settimana = $1',
      [data]
    );

    let configPresidio = {
      0: 'base', 1: 'base', 2: 'base', 3: 'base', 4: 'base',
      5: 'rinforzato', 6: 'rinforzato'
    };

    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];
      configPresidio = {
        0: config.tipo_presidio_lun || 'base',
        1: config.tipo_presidio_mar || 'base',
        2: config.tipo_presidio_mer || 'base',
        3: config.tipo_presidio_gio || 'base',
        4: config.tipo_presidio_ven || 'base',
        5: config.tipo_presidio_sab || 'rinforzato',
        6: config.tipo_presidio_dom || 'rinforzato'
      };
    }

    console.log('📊 Config presidio usato per validazioni:', configPresidio);

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

    // ✅ Validazioni presidio CON CONFIG DINAMICO
    const validazioniPresidio = [];
    for (let giorno = 0; giorno <= 6; giorno++) {
      const tipoPresidio = configPresidio[giorno];
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

/**
 * GET ORARIO TURNO (helper) - FIXED per mar/gio
 */
const getOrarioTurno = (tipoTurno, oreSettimanali, giorno) => {
  const conPausa = oreSettimanali >= 30;
  const oraApertura = (giorno === 1 || giorno === 3) ? '09:00' : '09:30';
  const offsetApertura = (giorno === 1 || giorno === 3) ? -0.5 : 0; // -30min per mar/gio
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

module.exports = {
  getValidazioniSettimana,
  validaDipendente,
  validaPresidioGiorno,
  calcolaContatoriDipendente
};