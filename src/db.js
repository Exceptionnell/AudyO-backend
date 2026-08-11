const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const err = new Error('DATABASE_URL manquante — historique persistant non configuré.');
    err.code = 'MISSING_DATABASE_URL';
    throw err;
  }
  if (!pool) {
    const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false }, // requis par la plupart des fournisseurs gérés (ex. Neon), inutile en local
    });
  }
  return pool;
}

// Crée la table au démarrage si elle n'existe pas encore — idempotent, sans
// migration lourde (dossier technique §3.8 : historique sécurisé).
async function ensureSchema() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL absente — l\'historique persistant restera désactivé.');
    return;
  }
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      transcript JSONB,
      summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_history_device ON history (device_id, created_at DESC);`);
  console.log('✅ Schéma de base de données prêt (table history).');
}

module.exports = { getPool, ensureSchema };
