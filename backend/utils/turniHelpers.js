// Utility per calcolo ore turni modulari
const { query } = require('../config/database');

/**
 * Calcola ore giornaliere ideali in base a ore settimanali
 * 40h → 8h/giorno (5 giorni)
 * 36h → 7.2h (arrotonda a 7h)
 * 30h → 6h
 * 24h → 4.8h (arrotonda a 5h)
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
 * Genera orari predefiniti per tipo turno e ore giornaliere
 */
const generaOrariTurno = (tipoTurno, oreGiorno) => {
  const orari = {
    APERTURA: {
      5: { inizio: '09:30', fine: '14:30' },
      6: { inizio: '09:30', fine: '15:30' },
      7: { inizio: '09:30', fine: '16:30' },
      8: { inizio: '09:30', fine: '17:30' }
    },
    'CENTRALE-A': {
      5: { inizio: '12:00', fine: '17:00' },
      6: { inizio: '12:00', fine: '18:00' },
      7: { inizio: '12:00', fine: '19:00' },
      8: { inizio: '11:00', fine: '19:00' }
    },
    'CENTRALE-B': {
      5: { inizio: '14:00', fine: '19:00' },
      6: { inizio: '14:00', fine: '20:00' },
      7: { inizio: '13:00', fine: '20:00' },
      8: { inizio: '13:00', fine: '21:00' }
    },
    CENTRALE: {
      5: { inizio: '13:00', fine: '18:00' },
      6: { inizio: '13:00', fine: '19:00' },
      7: { inizio: '12:00', fine: '19:00' },
      8: { inizio: '12:00', fine: '20:00' }
    },
    CHIUSURA: {
      5: { inizio: '17:00', fine: '22:00' },
      6: { inizio: '16:00', fine: '22:00' },
      7: { inizio: '15:00', fine: '22:00' },
      8: { inizio: '14:00', fine: '22:00' }
    }
  };

  return orari[tipoTurno]?.[oreGiorno] || orari[tipoTurno]?.[8] || { inizio: '09:30', fine: '17:30' };
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
  generaOrariTurno,
  verificaFestivita,
  getTipoFestivitaSettimana
};