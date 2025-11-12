-- Fix colonna ore_effettive per gestire pausa pranzo
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < database/fix_ore_effettive.sql

-- 1. Rimuovi colonna calcolata automaticamente
ALTER TABLE turni DROP COLUMN IF EXISTS ore_effettive;

-- 2. Ricrea come colonna normale (non più GENERATED)
ALTER TABLE turni ADD COLUMN ore_effettive DECIMAL(4,2);

-- 3. Crea funzione trigger per calcolo automatico con pausa
CREATE OR REPLACE FUNCTION calcola_ore_effettive()
RETURNS TRIGGER AS $$
DECLARE
  ore_settimanali INTEGER;
  ore_calcolate DECIMAL(4,2);
BEGIN
  -- Se OFF, FERIE o MALATTIA, gestito a parte
  IF NEW.tipo_turno IN ('OFF', 'FERIE', 'MALATTIA') THEN
    -- Per FERIE/MALATTIA le ore vengono impostate dal backend
    -- Per OFF resta NULL o 0
    IF NEW.ore_effettive IS NULL AND NEW.tipo_turno = 'OFF' THEN
      NEW.ore_effettive := 0;
    END IF;
    RETURN NEW;
  END IF;

  -- Calcola ore base dalla differenza orari
  ore_calcolate := EXTRACT(EPOCH FROM (NEW.ora_fine - NEW.ora_inizio)) / 3600;

  -- Ottieni ore settimanali dell'utente
  SELECT u.ore_settimanali INTO ore_settimanali
  FROM users u
  WHERE u.id = NEW.user_id;

  -- Se >= 30h contratto, sottrai 30 minuti (0.5h) per pausa pranzo
  IF ore_settimanali >= 30 THEN
    ore_calcolate := ore_calcolate - 0.5;
  END IF;

  -- Assicura che non sia negativo
  IF ore_calcolate < 0 THEN
    ore_calcolate := 0;
  END IF;

  NEW.ore_effettive := ore_calcolate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crea trigger
DROP TRIGGER IF EXISTS trigger_calcola_ore_effettive ON turni;
CREATE TRIGGER trigger_calcola_ore_effettive
  BEFORE INSERT OR UPDATE ON turni
  FOR EACH ROW
  EXECUTE FUNCTION calcola_ore_effettive();

-- 5. Ricalcola ore esistenti
UPDATE turni t
SET ora_inizio = t.ora_inizio; -- Forza il trigger

COMMENT ON COLUMN turni.ore_effettive IS 'Ore effettive lavorate (con sottrazione pausa pranzo 30min per contratti >= 30h)';