// Backend API - Negozio Turni
// Server Express.js completo

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const turniRoutes = require('./routes/turniRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(cors()); // Permette chiamate da frontend
app.use(express.json()); // Parse JSON body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded body

// Log richieste (in development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ===== ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Negozio Turni API v1.0',
    endpoints: {
      auth: [
        'POST /api/auth/login - Login',
        'GET  /api/auth/me - Dati utente corrente',
        'POST /api/auth/logout - Logout'
      ],
      users: [
        'GET    /api/users - Lista utenti (Manager)',
        'GET    /api/users/:id - Dettaglio utente',
        'POST   /api/users - Crea utente (Manager)',
        'PUT    /api/users/:id - Aggiorna utente (Manager)',
        'DELETE /api/users/:id - Elimina utente (Manager)'
      ],
      turni: [
        'GET    /api/turni/settimana/:data - Turni settimana',
        'GET    /api/turni/user/:userId/settimana/:data - Turni utente',
        'POST   /api/turni - Crea/aggiorna turno (Admin)',
        'DELETE /api/turni/:id - Elimina turno (Admin)',
        'GET    /api/turni/preferenze/:userId/settimana/:data - Preferenze',
        'POST   /api/turni/preferenze - Salva preferenze'
      ]
    }
  });
});

const validazioniRoutes = require('./routes/validazioniRoutes');
const algoritmoRoutes = require('./routes/algoritmoRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/turni', turniRoutes);
app.use('/api/validazioni', validazioniRoutes);
app.use('/api/algoritmo', algoritmoRoutes);

// ===== ERROR HANDLERS =====

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Errore non gestito:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ===== START SERVER =====
const startServer = async () => {
  try {
    // Test connessione database
    console.log('🔍 Test connessione database...');
    const dbConnected = await testConnection();
        if (!dbConnected) {
      console.error('❌ Impossibile connettersi al database. Server non avviato.');
      process.exit(1);
    }
    // ✅ Avvia scheduler archiviazione
    avviaScheduler();
    // Avvia server
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║   🚀 NEGOZIO TURNI API - RUNNING     ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log(`📍 Server:      http://localhost:${PORT}`);
      console.log(`🌐 API Docs:    http://localhost:${PORT}/api`);
      console.log(`🏥 Health:      http://localhost:${PORT}/api/health`);
      console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('Press Ctrl+C to stop');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Errore avvio server:', error);
    process.exit(1);
  }
};

// Gestione shutdown graceful
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM ricevuto. Chiusura server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT ricevuto. Chiusura server...');
  process.exit(0);
});
const presidioRoutes = require('./routes/presidioRoutes');
app.use('/api/presidio', presidioRoutes);

// Import scheduler e route storico
const { avviaScheduler } = require('./scheduler/archiviazione');
const storicoRoutes = require('./routes/storicoRoutes');

// Mount route storico
app.use('/api/storico', storicoRoutes);

startServer();