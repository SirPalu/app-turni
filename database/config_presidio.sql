-- Aggiorna tabella config_settimane per essere più semplice
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < config_presidio.sql

-- Già esiste, aggiungiamo solo funzioni helper

-- Funzione per ottenere config presidio con default
CREATE OR REPLACE FUNCTION get_presidio_config(p_settimana DATE)
RETURNS TABLE(giorno INTEGER, tipo_presidio VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN tipo_presidio_lun IS NOT NULL THEN 0 ELSE NULL 
    END as giorno,
    tipo_presidio_lun
  FROM config_settimane 
  WHERE settimana = p_settimana
  UNION ALL
  SELECT 1, tipo_presidio_mar FROM config_settimane WHERE settimana = p_settimana
  UNION ALL
  SELECT 2, tipo_presidio_mer FROM config_settimane WHERE settimana = p_settimana
  UNION ALL
  SELECT 3, tipo_presidio_gio FROM config_settimane WHERE settimana = p_settimana
  UNION ALL
  SELECT 4, tipo_presidio_ven FROM config_settimane WHERE settimana = p_settimana
  UNION ALL
  SELECT 5, tipo_presidio_sab FROM config_settimane WHERE settimana = p_settimana
  UNION ALL
  SELECT 6, tipo_presidio_dom FROM config_settimane WHERE settimana = p_settimana;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_presidio_config IS 'Ottiene configurazione presidio per settimana';