-- Script per CORREGGERE l'implementazione NL
-- NL non è un turno, ma un valore separato per settimana
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < database/fix_nl_implementation.sql

-- 1. Rimuovi NL dai tipi turno validi
ALTER TABLE turni DROP CONSTRAINT IF EXISTS turni_tipo_turno_check;
ALTER TABLE turni ADD CONSTRAINT turni_tipo_turno_check 
  CHECK (tipo_turno IN ('APERTURA', 'CENTRALE', 'CENTRALE-A', 'CENTRALE-B', 'CHIUSURA', 'FERIE', 'MALATTIA', 'OFF'));

-- 2. Crea tabella dedicata per ore NL
CREATE TABLE IF NOT EXISTS ore_nl_settimana (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settimana DATE NOT NULL, -- Lunedì della settimana
  ore_nl DECIMAL(5,2) NOT NULL CHECK (ore_nl > 0),
  motivo TEXT, -- Opzionale: motivo assegnazione
  assegnate_da INTEGER REFERENCES users(id), -- Chi ha assegnato le ore
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, settimana) -- Un solo valore NL per dipendente per settimana
);

-- 3. Indice per performance
CREATE INDEX IF NOT EXISTS idx_ore_nl_user_settimana ON ore_nl_settimana(user_id, settimana);

-- 4. Commenti
COMMENT ON TABLE ore_nl_settimana IS 'Ore Non Lavorato assegnate per settimana (sottratte da ore_da_recuperare cumulative)';
COMMENT ON COLUMN ore_nl_settimana.ore_nl IS 'Ore NL assegnate (es. 4.5 = 4 ore e 30 minuti)';
COMMENT ON COLUMN ore_nl_settimana.motivo IS 'Motivo assegnazione (opzionale, es: "Recupero straordinari")';

-- 5. Elimina eventuali turni NL esistenti (erano sbagliati)
DELETE FROM turni WHERE tipo_turno = 'NL';

-- 6. La colonna ore_nl in storico_contatori rimane (è corretta)
-- Quando archiviamo la settimana, copiamo il valore da ore_nl_settimana

-- 7. Test query per vedere struttura
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ore_nl_settimana'
ORDER BY ordinal_position;

-- 8. Messaggio finale
SELECT '✅ Tabella ore_nl_settimana creata correttamente' as status;
SELECT '✅ NL rimosso dai tipi turno' as status;
SELECT '✅ Sistema pronto per assegnazione NL separata dai turni' as status;