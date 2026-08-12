require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const conversationsRouter = require('./routes/conversations');
const translateRouter = require('./routes/translate');
const searchRouter = require('./routes/search');
const historyRouter = require('./routes/history');
const { ensureSchema } = require('./db');

const app = express();

// Render (comme la plupart des hébergeurs) place le service derrière un proxy
// inverse qui ajoute l'en-tête X-Forwarded-For — sans ce réglage, express-rate-limit
// rejette les requêtes car il ne peut pas identifier l'IP réelle de l'appelant.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// --- Sécurité de base ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Autorise les appels sans origine (apps mobiles natives) et les origines listées.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origine non autorisée par la politique CORS.'));
  },
}));
app.use(express.json({ limit: '1mb' }));

// Limite basique contre les abus — à affiner (par utilisateur authentifié) une fois l'auth en place.
app.use(rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));

// --- Routes ---
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/v1/conversations', conversationsRouter);
app.use('/v1/translate', translateRouter);
app.use('/v1/search', searchRouter);
app.use('/v1/history', historyRouter);

// --- 404 et erreurs ---
app.use((req, res) => res.status(404).json({ error: 'Route inconnue.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(PORT, async () => {
  console.log(`AudyO backend démarré sur http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY absente — copiez .env.example en .env et renseignez votre clé.');
  }
  try {
    await ensureSchema();
  } catch (err) {
    console.error('⚠️  Impossible d\'initialiser la base de données :', err.message);
  }
});
