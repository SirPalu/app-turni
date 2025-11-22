// Controller per export Excel settimana
const ExcelJS = require('exceljs');
const { query } = require('../config/database');

const GIORNI_NOMI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

/**
 * EXPORT SETTIMANA IN EXCEL
 * GET /api/export/settimana/:data
 */
const exportSettimanaExcel = async (req, res) => {
  try {
    const { data } = req.params;
    
    console.log(`📊 Generazione export Excel per settimana ${data}`);

    // Carica dati
    const turni = await caricaTurniSettimana(data);
    const utenti = await caricaUtenti();
    const contatori = await caricaContatori(data);

    // Crea workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Gestione Turni';
    workbook.created = new Date();

    // Sheet 1: Pianificazione Turni
    await creaSheetPianificazione(workbook, turni, utenti, data);

    // Sheet 2: Presidio Orario
    await creaSheetPresidio(workbook, turni, data);

    // Sheet 3: Contatori Dipendenti
    await creaSheetContatori(workbook, contatori, utenti, data);

    // Genera buffer Excel
    const buffer = await workbook.xlsx.writeBuffer();

    // Formatta nome file
    const dataObj = new Date(data);
    const nomeFile = `Turni_Settimana_${dataObj.toISOString().split('T')[0]}.xlsx`;

    // Imposta headers per download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
    res.setHeader('Content-Length', buffer.length);

    // Invia file
    res.send(buffer);
    console.log('✅ Export Excel completato');

  } catch (error) {
    console.error('❌ Errore export Excel:', error);
    res.status(500).json({ error: 'Errore nella generazione del file Excel' });
  }
};

// ===== FUNZIONI HELPER =====

const caricaTurniSettimana = async (settimana) => {
  const result = await query(
    `SELECT t.*, u.nome, u.username, u.ore_settimanali
     FROM turni t
     JOIN users u ON t.user_id = u.id 
     WHERE t.settimana = $1 AND u.ruolo != 'manager'
     ORDER BY t.giorno_settimana, t.ora_inizio`,
    [settimana]
  );

  // Organizza per giorno
  const turniPerGiorno = {};
  for (let i = 0; i <= 6; i++) {
    turniPerGiorno[i] = [];
  }

  result.rows.forEach(turno => {
    turniPerGiorno[turno.giorno_settimana].push(turno);
  });

  return turniPerGiorno;
};

const caricaUtenti = async () => {
  const result = await query(
    `SELECT id, nome, ore_settimanali FROM users WHERE ruolo != 'manager' ORDER BY nome`
  );
  return result.rows;
};

const caricaContatori = async (settimana) => {
  const utenti = await caricaUtenti();
  const contatori = [];

  for (const utente of utenti) {
    const turniResult = await query(
      `SELECT * FROM turni WHERE user_id = $1 AND settimana = $2`,
      [utente.id, settimana]
    );

    let ore_lavorate = 0;
    let giorni_off = 0;
    let aperture = 0;
    let chiusure = 0;
    let sabati = 0;
    let domeniche = 0;

    turniResult.rows.forEach(turno => {
      if (turno.tipo_turno === 'OFF') {
        giorni_off++;
      } else if (turno.ore_effettive) {
        ore_lavorate += parseFloat(turno.ore_effettive);
      }

      if (turno.tipo_turno === 'APERTURA') aperture++;
      if (turno.tipo_turno === 'CHIUSURA') chiusure++;
      if (turno.giorno_settimana === 5 && turno.tipo_turno !== 'OFF') sabati++;
      if (turno.giorno_settimana === 6 && turno.tipo_turno !== 'OFF') domeniche++;
    });

    const ore_contratto = utente.ore_settimanali;
    const ore_da_recuperare = ore_lavorate - ore_contratto;

    contatori.push({
      nome: utente.nome,
      ore_lavorate: ore_lavorate.toFixed(1),
      ore_contratto,
      ore_da_recuperare: ore_da_recuperare.toFixed(1),
      giorni_off,
      aperture,
      chiusure,
      sabati,
      domeniche
    });
  }

  return contatori;
};

// ===== SHEET 1: PIANIFICAZIONE TURNI =====
const creaSheetPianificazione = async (workbook, turni, utenti, settimana) => {
  const sheet = workbook.addWorksheet('Pianificazione Turni');

  // Titolo
  sheet.mergeCells('A1:O1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `PIANIFICAZIONE TURNI - Settimana del ${new Date(settimana).toLocaleDateString('it-IT')}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  titleCell.font = { ...titleCell.font, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).height = 25;

  // Headers
  const headerRow = sheet.getRow(2);
headerRow.values = ['Dipendente'];

// Calcola le date per ogni giorno della settimana
const dataBase = new Date(settimana);
GIORNI_NOMI.forEach((giorno, idx) => {
  const dataGiorno = new Date(dataBase);
  dataGiorno.setDate(dataBase.getDate() + idx);
  const giornoMese = dataGiorno.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  
  headerRow.values.push(`${giorno} ${giornoMese} - Inizio`, `${giorno} ${giornoMese} - Fine`);
});

  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  headerRow.height = 20;

  // Dati dipendenti
  let currentRow = 3;
  utenti.forEach(utente => {
    const row = sheet.getRow(currentRow);
    row.getCell(1).value = utente.nome;
    row.getCell(1).font = { bold: true };

    for (let giorno = 0; giorno <= 6; giorno++) {
      const turno = turni[giorno].find(t => t.user_id === utente.id);
      
      const colInizio = 2 + (giorno * 2);
      const colFine = 3 + (giorno * 2);

      if (turno && turno.tipo_turno !== 'OFF') {
        row.getCell(colInizio).value = turno.ora_inizio.substring(0, 5);
        row.getCell(colFine).value = turno.ora_fine.substring(0, 5);
        
        // Colora in base al tipo turno
        const color = getTurnoColor(turno.tipo_turno);
        row.getCell(colInizio).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        row.getCell(colFine).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      } else if (turno && turno.tipo_turno === 'OFF') {
        row.getCell(colInizio).value = 'OFF';
        row.getCell(colFine).value = 'OFF';
        row.getCell(colInizio).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        row.getCell(colFine).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
      } else {
        row.getCell(colInizio).value = '-';
        row.getCell(colFine).value = '-';
      }

      row.getCell(colInizio).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(colFine).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    row.height = 18;
    currentRow++;
  });

  // Larghezza colonne
  sheet.getColumn(1).width = 20; // Dipendente
  for (let i = 2; i <= 15; i++) {
    sheet.getColumn(i).width = 12;
  }

  // Bordi
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 2) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });
};

// ===== SHEET 2: PRESIDIO ORARIO =====
const creaSheetPresidio = async (workbook, turni, settimana) => {
  const sheet = workbook.addWorksheet('Presidio Orario');

  // Titolo
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `PRESIDIO ORARIO - Settimana del ${new Date(settimana).toLocaleDateString('it-IT')}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
  titleCell.font = { ...titleCell.font, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).height = 25;

  // Headers
  const headerRow = sheet.getRow(2);
  headerRow.values = ['Fascia Oraria', ...GIORNI_NOMI];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  headerRow.height = 20;

  // Genera fasce orarie 09:00 - 22:00 ogni 30 minuti
  const fasce = [];
  for (let ora = 9; ora < 22; ora++) {
    fasce.push(`${ora.toString().padStart(2, '0')}:00 - ${ora.toString().padStart(2, '0')}:30`);
    fasce.push(`${ora.toString().padStart(2, '0')}:30 - ${(ora + 1).toString().padStart(2, '0')}:00`);
  }
  fasce.push('22:00 - 22:30');

  let currentRow = 3;
  fasce.forEach(fascia => {
    const row = sheet.getRow(currentRow);
    row.getCell(1).value = fascia;
    row.getCell(1).font = { bold: true };

    const [inizioFascia] = fascia.split(' - ');
    const [h, m] = inizioFascia.split(':').map(Number);
    const minutiFascia = h * 60 + m;

    // Per ogni giorno, conta presenze
    for (let giorno = 0; giorno <= 6; giorno++) {
      let presenze = 0;
      
      turni[giorno].forEach(turno => {
        if (turno.tipo_turno === 'OFF') return;

        const [hInizio] = turno.ora_inizio.substring(0, 5).split(':').map(Number);
        const [hFine] = turno.ora_fine.substring(0, 5).split(':').map(Number);
        const minInizio = hInizio * 60;
        const minFine = hFine * 60;

        if (minutiFascia >= minInizio && minutiFascia < minFine) {
          presenze++;
        }
      });

      const cell = row.getCell(giorno + 2);
      cell.value = presenze;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Colora in base al numero presenze
      if (presenze === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      } else if (presenze === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
      } else if (presenze === 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
      }
    }

    row.height = 18;
    currentRow++;
  });

  // Larghezza colonne
  sheet.getColumn(1).width = 20;
  for (let i = 2; i <= 8; i++) {
    sheet.getColumn(i).width = 12;
  }

  // Bordi
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 2) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });
};

// ===== SHEET 3: CONTATORI DIPENDENTI =====
const creaSheetContatori = async (workbook, contatori, utenti, settimana) => {
  const sheet = workbook.addWorksheet('Contatori Dipendenti');

  // Titolo
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `CONTATORI DIPENDENTI - Settimana del ${new Date(settimana).toLocaleDateString('it-IT')}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  sheet.getRow(1).height = 25;

  // Headers
  const headerRow = sheet.getRow(2);
  headerRow.values = [
    'Dipendente',
    'Ore Lavorate',
    'Ore Contratto',
    'Ore da Recuperare',
    'Giorni OFF',
    'Aperture',
    'Chiusure',
    'Sabati',
    'Domeniche'
  ];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
  headerRow.height = 20;

  // Dati
  let currentRow = 3;
  contatori.forEach(cont => {
    const row = sheet.getRow(currentRow);
    row.values = [
      cont.nome,
      parseFloat(cont.ore_lavorate),
      cont.ore_contratto,
      parseFloat(cont.ore_da_recuperare),
      cont.giorni_off,
      cont.aperture,
      cont.chiusure,
      cont.sabati,
      cont.domeniche
    ];

    row.getCell(1).font = { bold: true };
    
    // Allineamento
    for (let i = 2; i <= 9; i++) {
      row.getCell(i).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Colora ore da recuperare
    const oreDaRecuperare = parseFloat(cont.ore_da_recuperare);
    const cellRecupero = row.getCell(4);
    if (oreDaRecuperare > 0) {
      cellRecupero.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
      cellRecupero.font = { color: { argb: 'FF9C0006' }, bold: true };
    } else if (oreDaRecuperare < 0) {
      cellRecupero.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
      cellRecupero.font = { color: { argb: 'FF006100' }, bold: true };
    }

    row.height = 18;
    currentRow++;
  });

  // Larghezza colonne
  sheet.getColumn(1).width = 20;
  for (let i = 2; i <= 9; i++) {
    sheet.getColumn(i).width = 15;
  }

  // Bordi
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 2) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });
};

// Helper: Colori turni
const getTurnoColor = (tipoTurno) => {
  const colors = {
    'APERTURA': 'FFFFEB9C',
    'CENTRALE': 'FFB4C7E7',
    'CENTRALE-A': 'FFB4C7E7',
    'CENTRALE-B': 'FFB4C7E7',
    'CHIUSURA': 'FFF4B084',
    'FERIE': 'FFC5E0B4',
    'MALATTIA': 'FFD9D9D9'
  };
  return colors[tipoTurno] || 'FFFFFFFF';
};

module.exports = {
  exportSettimanaExcel
};