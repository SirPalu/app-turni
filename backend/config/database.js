// Configurazione connessione PostgreSQL
const { Pool } = require('pg');

// Pool di connessioni: riutilizza connessioni invece di crearne sempre di nuove
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Massimo 20 connessioni simultanee
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log quando si connette
pool.on('connect', () => {
  console.log('✅ Connesso a PostgreSQL');
});

// Log errori di connessione
pool.on('error', (err) => {
  console.error('❌ Errore imprevisto nel pool PostgreSQL:', err);
});

// Funzione helper per query con logging
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query eseguita in ${duration}ms:`, text.substring(0, 50) + '...');
    return res;
  } catch (error) {
    console.error('❌ Errore query:', error.message);
    throw error;
  }
};

// Test connessione al database
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    console.log('🕐 Server time:', result.rows[0].now);
    console.log('🐘 PostgreSQL version:', result.rows[0].version.split(' ')[1]);
    return true;
  } catch (error) {
    console.error('❌ Test connessione fallito:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  testConnection
};