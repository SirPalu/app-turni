-- Script per sistema gestione richieste ferie
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < backend/database/add_ferie_system.sql

-- Drop tabella se esiste (solo per sviluppo)
DROP TABLE IF EXISTS richieste_ferie CASCADE;

-- Tabella richieste ferie
CREATE TABLE richieste_ferie (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_richiesta DATE NOT NULL, -- Singolo giorno richiesto
  tipo_approvazione VARCHAR(20) DEFAULT 'in_attesa' CHECK (tipo_approvazione IN ('in_attesa', 'approvata', 'rifiutata', 'off_approvato')),
  note_admin TEXT, -- Motivazione in caso di rifiuto o note
  richiesta_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  gestita_da INTEGER REFERENCES users(id), -- Admin che ha gestito
  gestita_il TIMESTAMP,
  visualizzata_da_dipendente BOOLEAN DEFAULT FALSE, -- Per notifiche
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, data_richiesta) -- Un dipendente può richiedere una data solo una volta
);

-- Indici per performance
CREATE INDEX idx_richieste_ferie_user ON richieste_ferie(user_id);
CREATE INDEX idx_richieste_ferie_data ON richieste_ferie(data_richiesta);
CREATE INDEX idx_richieste_ferie_stato ON richieste_ferie(tipo_approvazione);
CREATE INDEX idx_richieste_ferie_visualizzata ON richieste_ferie(visualizzata_da_dipendente);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_richieste_ferie_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_richieste_ferie
  BEFORE UPDATE ON richieste_ferie
  FOR EACH ROW
  EXECUTE FUNCTION update_richieste_ferie_timestamp();

-- Commenti
COMMENT ON TABLE richieste_ferie IS 'Richieste ferie dipendenti con approvazione admin';
COMMENT ON COLUMN richieste_ferie.tipo_approvazione IS 'Stato: in_attesa, approvata, rifiutata, off_approvato';
COMMENT ON COLUMN richieste_ferie.visualizzata_da_dipendente IS 'TRUE se dipendente ha visto la risposta admin';

SELECT '✅ Tabella richieste_ferie creata con successo' as status;