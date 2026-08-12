const express = require('express');

const router = express.Router();

// GET /v1/streaming-token
// Génère un jeton temporaire AssemblyAI (valable quelques minutes), pour que
// le navigateur puisse se connecter directement en WebSocket sans jamais
// voir la clé API permanente (les navigateurs ne peuvent pas fixer d'en-têtes
// sur une connexion WebSocket — voir dossier technique §4.3).
router.get('/', async (req, res) => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ASSEMBLYAI_API_KEY manquante sur le serveur.' });
  }
  try {
    const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=300', {
      headers: { authorization: apiKey },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`AssemblyAI a répondu ${response.status}: ${detail}`);
    }
    const data = await response.json();
    res.json({ token: data.token });
  } catch (err) {
    console.error('[streaming-token]', err.message);
    res.status(502).json({ error: "Le jeton de connexion n'a pas pu être généré." });
  }
});

module.exports = router;
