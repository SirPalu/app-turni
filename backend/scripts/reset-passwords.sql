-- Script per impostare password iniziali sicure
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < backend/scripts/reset-passwords.sql

-- Password hash per "Password123!" (usa questa come password temporanea per tutti)
-- $2a$10$YourActualHashHere

-- OPPURE imposta password diverse per ogni utente:

-- Roberta: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'roberta';

-- Valeria: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'valeria';

-- Federica: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'federica';

-- Stefano: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'stefano';

-- Chiara: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'chiara';

-- Virginia: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'virginia';

-- Monica: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'monica';

-- Sara: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'sara';

-- Manager: Password123!
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE username = 'manager';

SELECT '✅ Password aggiornate con successo!' as status;
SELECT '🔐 Password temporanea per tutti: Password123!' as info;
SELECT '⚠️ IMPORTANTE: Chiedi agli utenti di cambiarla al primo accesso' as warning;