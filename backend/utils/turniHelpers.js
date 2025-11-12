// Utility per calcolo ore turni modulari
const { query } = require('../config/database');

/**
 * Calcola ore giornaliere ideali in base a ore settimanali
 * Include pausa pranzo di 30 minuti per contratti >= 30h
 */
const calcolaOreGiornaliere = (oreSettimanali) => {
  const oreGiorno = oreSettimanali / 5; // 5 giorni lavorativi
  
  // Arrotondamenti per semplicità
  if (oreGiorno >= 7.5) return 8;
  if (oreGiorno >= 6.5) return 7;
  if (oreGiorno >= 5.5) return 6;
  return 5;
};

/**
 * Calcola ore ferie/malattia in base a ore settimanali
 * Formula: ore_settimanali / 6
 * Eccezione: 40h = 8h (non 6.67h)
 */
const calcolaOreFerieMalattia = (oreSettimanali) => {
  if (oreSettimanali === 40) return 8;
  return Math.round((oreSettimanali / 6) * 10) / 10; // Arrotonda a 1 decimale
};

/**
 * Verifica se il turno necessita pausa pranzo
 * Pausa obbligatoria per contratti >= 30h
 */
const hapausaPranzo = (oreSettimanali) => {
  return oreSettimanali >= 30;
};

/**
 * Genera orari predefiniti per tipo turno e ore giornaliere
 * INCLUDE PAUSA PRANZO di 30 minuti per contratti >= 30h
 */
const generaOrariTurno = (tipoTurno, oreGiorno, oreSettimanali = 36, giornoSettimana = 0) => {
  const conPausa = haususaPranzo(oreSettimanali);
  
  // MARTEDÌ (1) e GIOVEDÌ (3) hanno apertura alle 9:00
  const oraApertura = (giornoSettimana === 1 || giornoSettimana === 3) ? '09:00' : '09:30';
  
  const orari = {
    APERTURA: {
      5: { 
        inizio: oraApertura, 
        fine: conPausa ? '15:00' : '14:30' // +30min se pausa
      },
      6: { 
        inizio: oraApertura, 
        fine: conPausa ? '16:00' : '15:30' 
      },
      7: { 
        inizio: oraApertura, 
        fine: conPausa ? '17:00' : '16:30' 
      },
      8: { 
        inizio: oraApertura, 
        fine: conPausa ? '18:00' : '17:30' 
      }
    },
    'CENTRALE-A': {
      5: { 
        inizio: '12:00', 
        fine: conPausa ? '17:30' : '17:00' 
      },
      6: { 
        inizio: '12:00', 
        fine: conPausa ? '18:30' : '18:00' 
      },
      7: { 
        inizio: '12:00', 
        fine: conPausa ? '19:30' : '19:00' 
      },
      8: { 
        inizio: '11:00', 
        fine: conPausa ? '19:30' : '19:00' 
      }
    },
    'CENTRALE-B': {
      5: { 
        inizio: '14:00', 
        fine: conPausa ? '19:30' : '19:00' 
      },
      6: { 
        inizio: '14:00', 
        fine: conPausa ? '20:30' : '20:00' 
      },
      7: { 
        inizio: '13:00', 
        fine: conPausa ? '20:30' : '20:00' 
      },
      8: { 
        inizio: '13:00', 
        fine: conPausa ? '21:30' : '21:00' 
      }
    },
    CENTRALE: {
      5: { 
        inizio: '13:00', 
        fine: conPausa ? '18:30' : '18:00' 
      },
      6: { 
        inizio: '13:00', 
        fine: conPausa ? '19:30' : '19:00' 
      },
      7: { 
        inizio: '12:00', 
        fine: conPausa ? '19:30' : '19:00' 
      },
      8: { 
        inizio: '12:00', 
        fine: conPausa ? '20:30' : '20:00' 
      }
    },
    CHIUSURA: {
      5: { 
        inizio: conPausa ? '16:30' : '17:00', // -30min inizio se pausa
        fine: '22:00' 
      },
      6: { 
        inizio: conPausa ? '15:30' : '16:00', 
        fine: '22:00' 
      },
      7: { 
        inizio: conPausa ? '14:30' : '15:00', 
        fine: '22:00' 
      },
      8: { 
        inizio: conPausa ? '13:30' : '14:00', 
        fine: '22:00' 
      }
    },
    FERIE: { inizio: '00:00', fine: '00:00' },
    MALATTIA: { inizio: '00:00', fine: '00:00' },
    OFF: { inizio: '00:00', fine: '00:00' }
  };

  return orari[tipoTurno]?.[oreGiorno] || orari[tipoTurno]?.[8] || { inizio: oraApertura, fine: '17:30' };
};

/**
 * Verifica se una data è festivo o prefestivo
 */
const verificaFestivita = async (data) => {
  const result = await query(
    'SELECT tipo FROM festivita WHERE data = $1',
    [data]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0].tipo; // 'festivo' o 'prefestivo'
  }
  
  // Se non è in DB, controlla se è sabato (prefestivo) o domenica (festivo)
  const giorno = new Date(data).getDay();
  if (giorno === 0) return 'festivo'; // Domenica
  if (giorno === 6) return 'prefestivo'; // Sabato
  
  return null;
};

/**
 * Ottieni tipo festività per giorno della settimana
 */
const getTipoFestivitaSettimana = async (settimana) => {
  const tipi = {};
  
  for (let giorno = 0; giorno <= 6; giorno++) {
    const data = new Date(settimana);
    data.setDate(data.getDate() + giorno);
    const dataStr = data.toISOString().split('T')[0];
    
    tipi[giorno] = await verificaFestivita(dataStr);
  }
  
  return tipi;
};

module.exports = {
  calcolaOreGiornaliere,
  calcolaOreFerieMalattia,
  hapausaPranzo,
  generaOrariTurno,
  verificaFestivita,
  getTipoFestivitaSettimana
};