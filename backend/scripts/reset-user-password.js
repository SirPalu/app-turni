// Script per resettare password di un singolo utente
// Uso: node backend/scripts/reset-user-password.js <username> <nuova_password>

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const username = process.argv[2];
const newPassword = process.argv[3];

if (!username || !newPassword) {
  console.error('❌ Errore: Specifica username e password');
  console.log('Uso: node backend/scripts/reset-user-password.js <username> <nuova_password>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/negozio_turni'
});

const SALT_ROUNDS = 10;

async function resetPassword() {
  try {
    console.log(`\n🔄 Reset password per utente: ${username}`);
    
    // Verifica che utente esista
    const checkUser = await pool.query(
      'SELECT id, nome FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    
    if (checkUser.rows.length === 0) {
      console.error(`❌ Utente '${username}' non trovato nel database`);
      process.exit(1);
    }
    
    const user = checkUser.rows[0];
    console.log(`✅ Utente trovato: ${user.nome} (ID: ${user.id})`);
    
    // Genera hash password
    console.log('🔐 Generazione hash password...');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Aggiorna password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );
    
    console.log('✅ Password aggiornata con successo!');
    console.log(`\n📋 Dettagli:`);
    console.log(`   Username: ${username}`);
    console.log(`   Nome: ${user.nome}`);
    console.log(`   Nuova Password: ${newPassword}`);
    console.log(`\n⚠️  IMPORTANTE: Comunica la nuova password all'utente in modo sicuro`);
    
  } catch (error) {
    console.error('❌ Errore durante il reset:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetPassword();