const express = require('express');
const { callClaude } = require('../services/claude');

const router = express.Router();

// POST /v1/search
// Body attendu : { query: "...", transcript: "..." }
// Recherche en langage naturel dans une transcription déjà collectée côté client
// (session en cours, tant que l'historique persistant n'est pas branché — dossier §3.8).
router.post('/', async (req, res) => {
  const { query, transcript } = req.body || {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Le champ "query" est requis.' });
  }
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'Le champ "transcript" est requis.' });
  }
  if (transcript.length > 20000) {
    return res.status(400).json({ error: 'Transcription trop longue pour cette version.' });
  }

  const prompt =
    "Tu es le module de recherche IA d'AudyO. Voici une transcription de conversations passées, " +
    "puis une question de l'utilisateur sur cette transcription. Réponds en français, brièvement " +
    "(2-3 phrases maximum), en te basant uniquement sur ce qui est écrit dans la transcription. " +
    "Si la réponse ne s'y trouve pas, dis-le clairement plutôt que d'inventer.\n\n" +
    `Transcription :\n${transcript}\n\nQuestion : ${query}`;

  try {
    const answer = await callClaude(prompt, 300);
    res.json({ answer });
  } catch (err) {
    console.error('[search]', err.code || '', err.message);
    res.status(502).json({ error: "La recherche n'a pas pu aboutir. Réessayez." });
  }
});

module.exports = router;
