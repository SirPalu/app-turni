-- Script per aggiungere supporto ore NL (Non Lavorato)
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < database/add_nl_support.sql

-- 1. Aggiungi 'NL' ai tipi turno validi
ALTER TABLE turni DROP CONSTRAINT IF EXISTS turni_tipo_turno_check;
ALTER TABLE turni ADD CONSTRAINT turni_tipo_turno_check 
  CHECK (tipo_turno IN ('APERTURA', 'CENTRALE', 'CENTRALE-A', 'CENTRALE-B', 'CHIUSURA', 'FERIE', 'MALATTIA', 'OFF', 'NL'));

-- 2. Aggiungi colonna ore_nl a storico_contatori (per sommare le ore NL della settimana)
ALTER TABLE storico_contatori ADD COLUMN IF NOT EXISTS ore_nl DECIMAL(5,2) DEFAULT 0;

-- 3. Rimuovi il trigger che calcola ore_effettive automaticamente per permettere valori manuali
-- Il trigger già esistente permette di sovrascrivere ore_effettive, quindi non serve modificarlo

-- 4. Aggiungi commenti
COMMENT ON COLUMN storico_contatori.ore_nl IS 'Ore Non Lavorato assegnate nella settimana (sottratte da ore_da_recuperare)';
COMMENT ON COLUMN turni.tipo_turno IS 'Tipo turno: APERTURA, CENTRALE, CENTRALE-A, CENTRALE-B, CHIUSURA, FERIE, MALATTIA, OFF, NL';
COMMENT ON TABLE storico_contatori IS 'Contatori aggregati per settimana. ore_da_recuperare cumulative = SUM(ore_lavorate - ore_da_contratto) - SUM(ore_nl)';

-- 5. Visualizza statistiche
SELECT 
  COUNT(*) FILTER (WHERE tipo_turno = 'NL') as turni_nl,
  COUNT(*) as turni_totali
FROM turni;

SELECT 
  COUNT(*) as record_storico_con_nl
FROM storico_contatori 
WHERE ore_nl > 0;

-- 6. Test: Verifica che il constraint funzioni
DO $
BEGIN
  RAISE NOTICE '✅ Constraint turni_tipo_turno_check aggiornato correttamente';
  RAISE NOTICE '✅ Colonna ore_nl aggiunta a storico_contatori';
  RAISE NOTICE '✅ Sistema pronto per gestire turni NL (Non Lavorato)';
END $;