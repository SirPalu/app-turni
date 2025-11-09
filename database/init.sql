-- Script di inizializzazione database negozio_turni
-- Eseguito automaticamente alla prima creazione del container

-- ====================
-- TABELLA UTENTI
-- ====================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ruolo VARCHAR(20) NOT NULL CHECK (ruolo IN ('dipendente', 'amministratore', 'manager')),
    ore_settimanali INTEGER NOT NULL CHECK (ore_settimanali >= 0),
    ha_chiavi BOOLEAN DEFAULT FALSE,
    ferie_ore_mese DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA FESTIVITÀ
-- ====================
CREATE TABLE festivita (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('festivo', 'prefestivo')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA PREFERENZE
-- ====================
CREATE TABLE preferenze (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settimana DATE NOT NULL, -- Lunedì della settimana
    giorno_settimana INTEGER NOT NULL CHECK (giorno_settimana BETWEEN 0 AND 6), -- 0=Lun, 6=Dom
    tipo_preferenza VARCHAR(20) NOT NULL CHECK (tipo_preferenza IN ('OFF', 'APERTURA', 'CHIUSURA')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, settimana, giorno_settimana)
);

-- ====================
-- TABELLA TURNI
-- ====================
CREATE TABLE turni (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settimana DATE NOT NULL, -- Lunedì della settimana
    giorno_settimana INTEGER NOT NULL CHECK (giorno_settimana BETWEEN 0 AND 6),
    ora_inizio TIME NOT NULL,
    ora_fine TIME NOT NULL,
    tipo_turno VARCHAR(20) NOT NULL CHECK (tipo_turno IN ('APERTURA', 'CENTRALE', 'CHIUSURA', 'FERIE', 'MALATTIA')),
    ore_effettive DECIMAL(4,2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (ora_fine - ora_inizio)) / 3600
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, settimana, giorno_settimana)
);

-- ====================
-- TABELLA FERIE
-- ====================
CREATE TABLE ferie (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_inizio DATE NOT NULL,
    data_fine DATE NOT NULL,
    stato VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (stato IN ('pending', 'approvata', 'rifiutata')),
    ore_totali DECIMAL(6,2),
    approvata_da INTEGER REFERENCES users(id),
    approvata_il TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (data_fine >= data_inizio)
);

-- ====================
-- TABELLA STORICO CONTATORI
-- ====================
CREATE TABLE storico_contatori (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settimana DATE NOT NULL, -- Lunedì della settimana
    ore_lavorate DECIMAL(5,2) DEFAULT 0,
    ore_da_contratto INTEGER NOT NULL,
    ore_da_recuperare DECIMAL(6,2) DEFAULT 0, -- Cumulativo
    giorni_off INTEGER DEFAULT 0,
    giorni_pfes INTEGER DEFAULT 0, -- Prefestivi lavorati
    giorni_fes INTEGER DEFAULT 0,  -- Festivi lavorati
    turni_apertura INTEGER DEFAULT 0,
    turni_chiusura INTEGER DEFAULT 0,
    ferie_maturate DECIMAL(6,2) DEFAULT 0, -- Cumulativo
    ferie_usufruite DECIMAL(6,2) DEFAULT 0, -- Cumulativo
    storicizzata BOOLEAN DEFAULT FALSE,
    storicizzata_il TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, settimana)
);

-- ====================
-- TABELLA CONFIGURAZIONE SETTIMANE
-- ====================
CREATE TABLE config_settimane (
    id SERIAL PRIMARY KEY,
    settimana DATE NOT NULL UNIQUE, -- Lunedì della settimana
    stato VARCHAR(20) NOT NULL DEFAULT 'pianificazione' 
        CHECK (stato IN ('pianificazione', 'bozza', 'confermata', 'approvata', 'storicizzata')),
    tipo_presidio_lun VARCHAR(20) DEFAULT 'base' CHECK (tipo_presidio_lun IN ('base', 'rinforzato')),
    tipo_presidio_mar VARCHAR(20) DEFAULT 'base' CHECK (tipo_presidio_mar IN ('base', 'rinforzato')),
    tipo_presidio_mer VARCHAR(20) DEFAULT 'base' CHECK (tipo_presidio_mer IN ('base', 'rinforzato')),
    tipo_presidio_gio VARCHAR(20) DEFAULT 'base' CHECK (tipo_presidio_gio IN ('base', 'rinforzato')),
    tipo_presidio_ven VARCHAR(20) DEFAULT 'base' CHECK (tipo_presidio_ven IN ('base', 'rinforzato')),
    tipo_presidio_sab VARCHAR(20) DEFAULT 'rinforzato' CHECK (tipo_presidio_sab IN ('base', 'rinforzato')),
    tipo_presidio_dom VARCHAR(20) DEFAULT 'rinforzato' CHECK (tipo_presidio_dom IN ('base', 'rinforzato')),
    pubblicata_il TIMESTAMP,
    confermata_il TIMESTAMP,
    approvata_il TIMESTAMP,
    approvata_da INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INDICI PER PERFORMANCE
-- ====================
CREATE INDEX idx_turni_user_settimana ON turni(user_id, settimana);
CREATE INDEX idx_preferenze_user_settimana ON preferenze(user_id, settimana);
CREATE INDEX idx_storico_user ON storico_contatori(user_id);
CREATE INDEX idx_ferie_user_date ON ferie(user_id, data_inizio, data_fine);
CREATE INDEX idx_festivita_data ON festivita(data);

-- ====================
-- DATI DI TEST
-- ====================

-- Password per tutti gli utenti: "password123"
-- Hash bcrypt: $2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u
-- NOTA: Questo è un hash TEMPORANEO per sviluppo. Il backend lo aggiornerà con hash veri.

INSERT INTO users (username, password_hash, nome, ruolo, ore_settimanali, ha_chiavi, ferie_ore_mese) VALUES
('roberta', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Roberta', 'dipendente', 40, TRUE, 14),
('valeria', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Valeria', 'dipendente', 36, TRUE, 12.6),
('federica', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Federica', 'amministratore', 36, TRUE, 12.6),
('stefano', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Stefano', 'dipendente', 36, TRUE, 12.6),
('chiara', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Chiara', 'dipendente', 24, FALSE, 8.4),
('virginia', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Virginia', 'dipendente', 24, TRUE, 8.4),
('monica', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Monica', 'dipendente', 30, TRUE, 10.5),
('sara', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Sara', 'dipendente', 24, FALSE, 8.4),
('manager', '$2b$10$rK8qVxZxZxZxZxZxZxZxZuO4YqH0vY0vY0vY0vY0vY0vY0vY0vY0u', 'Manager', 'manager', 40, TRUE, 14);

-- Festività 2025 (esempio)
INSERT INTO festivita (data, nome, tipo) VALUES
('2025-01-01', 'Capodanno', 'festivo'),
('2025-01-06', 'Epifania', 'festivo'),
('2025-04-21', 'Pasquetta', 'festivo'),
('2025-04-25', 'Liberazione', 'festivo'),
('2025-05-01', 'Festa del Lavoro', 'festivo'),
('2025-06-02', 'Festa della Repubblica', 'festivo'),
('2025-08-15', 'Ferragosto', 'festivo'),
('2025-11-01', 'Ognissanti', 'festivo'),
('2025-12-08', 'Immacolata', 'festivo'),
('2025-12-25', 'Natale', 'festivo'),
('2025-12-26', 'Santo Stefano', 'festivo');

-- Prefestivi (giorni prima dei festivi)
INSERT INTO festivita (data, nome, tipo) VALUES
('2024-12-31', 'Prefestivo Capodanno', 'prefestivo'),
('2025-01-05', 'Prefestivo Epifania', 'prefestivo'),
('2025-04-20', 'Prefestivo Pasquetta', 'prefestivo'),
('2025-04-24', 'Prefestivo Liberazione', 'prefestivo'),
('2025-04-30', 'Prefestivo 1 Maggio', 'prefestivo'),
('2025-06-01', 'Prefestivo Repubblica', 'prefestivo'),
('2025-08-14', 'Prefestivo Ferragosto', 'prefestivo'),
('2025-10-31', 'Prefestivo Ognissanti', 'prefestivo'),
('2025-12-07', 'Prefestivo Immacolata', 'prefestivo'),
('2025-12-24', 'Vigilia di Natale', 'prefestivo');

-- Tutti i sabati sono prefestivi automaticamente (gestito dall'app)

COMMENT ON TABLE users IS 'Anagrafica dipendenti e utenti del sistema';
COMMENT ON TABLE turni IS 'Turni assegnati per ogni settimana';
COMMENT ON TABLE preferenze IS 'Preferenze inviate dai dipendenti';
COMMENT ON TABLE storico_contatori IS 'Contatori aggregati per settimana (ore, OFF, PFes, ecc)';
COMMENT ON TABLE config_settimane IS 'Configurazione e stato di ogni settimana pianificata';