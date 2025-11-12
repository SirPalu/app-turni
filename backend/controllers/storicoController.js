// Controller per storico contatori
const { query } = require('../config/database');

/**
 * GET STORICO RIASSUNTIVO (totali cumulativi per dipendente)
 * GET /api/storico/riassuntivo
 */
const getStoricoRiassuntivo = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        u.id,
        u.nome,
        u.ore_settimanali,
        COALESCE(SUM(s.ore_lavorate), 0) as ore_totali,
        COALESCE(SUM(s.turni_apertura), 0) as aperture_totali,
        COALESCE(SUM(s.turni_chiusura), 0) as chiusure_totali,
        COALESCE(SUM(s.giorni_pfes), 0) as sabati_totali,
        COALESCE(SUM(s.giorni_fes), 0) as domeniche_totali,
        COALESCE(SUM(s.giorni_off), 0) as off_totali,
        COUNT(s.id) as settimane_lavorate,
        MIN(s.settimana) as prima_settimana,
        MAX(s.settimana) as ultima_settimana
       FROM users u
       LEFT JOIN storico_contatori s ON u.id = s.user_id AND s.storicizzata = TRUE
       WHERE u.ruolo != 'manager'
       GROUP BY u.id, u.nome, u.ore_settimanali
       ORDER BY u.nome`
    );

    // Calcola medie e sbilanciamenti
    const dipendenti = result.rows;
    
    if (dipendenti.length > 0) {
      const medieDomeniche = dipendenti.reduce((sum, d) => sum + parseFloat(d.domeniche_totali), 0) / dipendenti.length;
      const medieSabati = dipendenti.reduce((sum, d) => sum + parseFloat(d.sabati_totali), 0) / dipendenti.length;
      const medieChiusure = dipendenti.reduce((sum, d) => sum + parseFloat(d.chiusure_totali), 0) / dipendenti.length;

      dipendenti.forEach(d => {
        d.diff_domeniche = (parseFloat(d.domeniche_totali) - medieDomeniche).toFixed(1);
        d.diff_sabati = (parseFloat(d.sabati_totali) - medieSabati).toFixed(1);
        d.diff_chiusure = (parseFloat(d.chiusure_totali) - medieChiusure).toFixed(1);
      });
    }

    res.json({
      dipendenti,
      statistiche: {
        totale_dipendenti: dipendenti.length,
        media_domeniche: dipendenti.length > 0 
          ? (dipendenti.reduce((sum, d) => sum + parseFloat(d.domeniche_totali), 0) / dipendenti.length).toFixed(1)
          : 0,
        media_sabati: dipendenti.length > 0
          ? (dipendenti.reduce((sum, d) => sum + parseFloat(d.sabati_totali), 0) / dipendenti.length).toFixed(1)
          : 0,
        media_chiusure: dipendenti.length > 0
          ? (dipendenti.reduce((sum, d) => sum + parseFloat(d.chiusure_totali), 0) / dipendenti.length).toFixed(1)
          : 0
      }
    });

  } catch (error) {
    console.error('Errore get storico riassuntivo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * GET DETTAGLIO STORICO DIPENDENTE
 * GET /api/storico/dipendente/:userId
 */
const getStoricoDettaglioDipendente = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT s.*, u.nome
       FROM storico_contatori s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.storicizzata = TRUE
       ORDER BY s.settimana DESC`,
      [userId]
    );

    res.json({
      userId: parseInt(userId),
      nome: result.rows[0]?.nome || 'Unknown',
      storico: result.rows
    });

  } catch (error) {
    console.error('Errore get storico dipendente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

module.exports = {
  getStoricoRiassuntivo,
  getStoricoDettaglioDipendente
};