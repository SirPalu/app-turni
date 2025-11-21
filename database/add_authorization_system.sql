-- Sistema di autorizzazione settimane
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < database/add_authorization_system.sql

-- 1. Aggiorna stati possibili in config_settimane
ALTER TABLE config_settimane DROP CONSTRAINT IF EXISTS config_settimane_stato_check;
ALTER TABLE config_settimane ADD CONSTRAINT config_settimane_stato_check 
  CHECK (stato IN ('pianificazione', 'bozza', 'confermata', 'autorizzata', 'rifiutata'));

-- 2. Aggiungi colonne per workflow autorizzazione
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS pubblicata_il TIMESTAMP;
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS pubblicata_da INTEGER REFERENCES users(id);
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS confermata_il TIMESTAMP;
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS confermata_da INTEGER REFERENCES users(id);
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS autorizzata_il TIMESTAMP;
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS autorizzata_da INTEGER REFERENCES users(id);
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS rifiutata_il TIMESTAMP;
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS rifiutata_da INTEGER REFERENCES users(id);
ALTER TABLE config_settimane ADD COLUMN IF NOT EXISTS note_rifiuto TEXT;

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_config_settimane_stato ON config_settimane(stato);
CREATE INDEX IF NOT EXISTS idx_config_settimane_settimana ON config_settimane(settimana);

-- 4. Commenti
COMMENT ON COLUMN config_settimane.stato IS 'Stato workflow: pianificazione, bozza, confermata, autorizzata, rifiutata';
COMMENT ON COLUMN config_settimane.pubblicata_il IS 'Timestamp pubblicazione bozza (visibile dipendenti)';
COMMENT ON COLUMN config_settimane.confermata_il IS 'Timestamp conferma settimana (visibile manager)';
COMMENT ON COLUMN config_settimane.autorizzata_il IS 'Timestamp autorizzazione manager';
COMMENT ON COLUMN config_settimane.note_rifiuto IS 'Note manager in caso di rifiuto';

SELECT '✅ Sistema autorizzazione settimane installato' as status;