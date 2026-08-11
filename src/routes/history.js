const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

function requireDeviceId(req, res) {
  const deviceId = req.query.deviceId || (req.body && req.body.deviceId);
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
    res.status(400).json({ error: 'Le champ "deviceId" est requis.' });
    return null;
  }
  return deviceId;
}

// POST /v1/history — enregistre une entrée (conversation, réunion, traduction…)
// Body : { deviceId, kind, title, transcript, summary }
router.post('/', async (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;

  const { kind, title, transcript, summary } = req.body || {};
  if (!kind || !title) {
    return res.status(400).json({ error: 'Les champs "kind" et "title" sont requis.' });
  }

  try {
    const db = getPool();
    const result = await db.query(
      `INSERT INTO history (device_id, kind, title, transcript, summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [deviceId, String(kind).slice(0, 40), String(title).slice(0, 200), JSON.stringify(transcript || null), summary ? String(summary).slice(0, 8000) : null]
    );
    res.status(201).json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error('[history:save]', err.code || '', err.message);
    res.status(502).json({ error: "L'entrée n'a pas pu être enregistrée." });
  }
});

// GET /v1/history?deviceId=... — liste les entrées de cet appareil, plus récentes d'abord
router.get('/', async (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT id, kind, title, summary, created_at FROM history
       WHERE device_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [deviceId]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('[history:list]', err.code || '', err.message);
    res.status(502).json({ error: "L'historique n'a pas pu être chargé." });
  }
});

// GET /v1/history/:id?deviceId=... — détail d'une entrée (avec transcript complet)
router.get('/:id', async (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT id, kind, title, transcript, summary, created_at FROM history WHERE id = $1 AND device_id = $2`,
      [req.params.id, deviceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[history:get]', err.code || '', err.message);
    res.status(502).json({ error: "L'entrée n'a pas pu être chargée." });
  }
});

// DELETE /v1/history/:id?deviceId=... — suppression (droit à l'effacement, dossier §6 RGPD)
router.delete('/:id', async (req, res) => {
  const deviceId = requireDeviceId(req, res);
  if (!deviceId) return;

  try {
    const db = getPool();
    await db.query(`DELETE FROM history WHERE id = $1 AND device_id = $2`, [req.params.id, deviceId]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[history:delete]', err.code || '', err.message);
    res.status(502).json({ error: "La suppression a échoué." });
  }
});

module.exports = router;
