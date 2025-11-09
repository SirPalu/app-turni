-- Aggiornamento festività 2025-2026
-- Esegui: docker exec -i negozio-db psql -U admin -d negozio_turni < festivita_update.sql

-- Elimina vecchie per evitare duplicati
DELETE FROM festivita;

-- ========== 2025 ==========
-- Festivi
INSERT INTO festivita (data, nome, tipo) VALUES
('2025-01-01', 'Capodanno', 'festivo'),
('2025-01-06', 'Epifania', 'festivo'),
('2025-04-20', 'Pasqua', 'festivo'),
('2025-04-21', 'Pasquetta', 'festivo'),
('2025-04-25', 'Liberazione', 'festivo'),
('2025-05-01', 'Festa del Lavoro', 'festivo'),
('2025-06-02', 'Festa della Repubblica', 'festivo'),
('2025-08-15', 'Ferragosto', 'festivo'),
('2025-11-01', 'Ognissanti', 'festivo'),
('2025-12-08', 'Immacolata', 'festivo'),
('2025-12-25', 'Natale', 'festivo'),
('2025-12-26', 'Santo Stefano', 'festivo');

-- Prefestivi (giorno prima di festivi)
INSERT INTO festivita (data, nome, tipo) VALUES
('2024-12-31', 'Prefestivo Capodanno', 'prefestivo'),
('2025-01-05', 'Prefestivo Epifania', 'prefestivo'),
('2025-04-19', 'Sabato Santo', 'prefestivo'),
('2025-04-24', 'Prefestivo Liberazione', 'prefestivo'),
('2025-04-30', 'Prefestivo 1 Maggio', 'prefestivo'),
('2025-06-01', 'Prefestivo Repubblica', 'prefestivo'),
('2025-08-14', 'Prefestivo Ferragosto', 'prefestivo'),
('2025-10-31', 'Prefestivo Ognissanti', 'prefestivo'),
('2025-12-07', 'Prefestivo Immacolata', 'prefestivo'),
('2025-12-24', 'Vigilia di Natale', 'prefestivo');

-- ========== 2026 ==========
-- Festivi
INSERT INTO festivita (data, nome, tipo) VALUES
('2026-01-01', 'Capodanno', 'festivo'),
('2026-01-06', 'Epifania', 'festivo'),
('2026-04-05', 'Pasqua', 'festivo'),
('2026-04-06', 'Pasquetta', 'festivo'),
('2026-04-25', 'Liberazione', 'festivo'),
('2026-05-01', 'Festa del Lavoro', 'festivo'),
('2026-06-02', 'Festa della Repubblica', 'festivo'),
('2026-08-15', 'Ferragosto', 'festivo'),
('2026-11-01', 'Ognissanti', 'festivo'),
('2026-12-08', 'Immacolata', 'festivo'),
('2026-12-25', 'Natale', 'festivo'),
('2026-12-26', 'Santo Stefano', 'festivo');

-- Prefestivi 2026
INSERT INTO festivita (data, nome, tipo) VALUES
('2025-12-31', 'Prefestivo Capodanno', 'prefestivo'),
('2026-01-05', 'Prefestivo Epifania', 'prefestivo'),
('2026-04-04', 'Sabato Santo', 'prefestivo'),
('2026-04-24', 'Prefestivo Liberazione', 'prefestivo'),
('2026-04-30', 'Prefestivo 1 Maggio', 'prefestivo'),
('2026-06-01', 'Prefestivo Repubblica', 'prefestivo'),
('2026-08-14', 'Prefestivo Ferragosto', 'prefestivo'),
('2026-10-31', 'Prefestivo Ognissanti', 'prefestivo'),
('2026-12-07', 'Prefestivo Immacolata', 'prefestivo'),
('2026-12-24', 'Vigilia di Natale', 'prefestivo');

-- Aggiungi indice per performance
CREATE INDEX IF NOT EXISTS idx_festivita_data ON festivita(data);

COMMENT ON TABLE festivita IS 'Calendario festività nazionali - aggiornato 2025-2026';