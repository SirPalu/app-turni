// Script per generare hash bcrypt di password
// Uso: node backend/scripts/generate-password-hash.js "TuaPasswordQui"

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('❌ Errore: Specifica una password come argomento');
  console.log('Uso: node backend/scripts/generate-password-hash.js "TuaPasswordQui"');
  process.exit(1);
}

const SALT_ROUNDS = 10;

bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
  if (err) {
    console.error('❌ Errore generazione hash:', err);
    process.exit(1);
  }
  
  console.log('\n🔐 Password Hash Generato:\n');
  console.log(hash);
  console.log('\n📋 Query SQL per aggiornare utente:\n');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'NOME_UTENTE';`);
  console.log('');
});