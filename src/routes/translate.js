const express = require('express');
const { callClaude } = require('../services/claude');

const router = express.Router();

// Table de correspondance code langue -> libellé, pour un prompt plus fiable
// qu'en envoyant directement des codes BCP47 au modèle.
const LANGUAGE_LABELS = {
  'fr-FR': 'Français', 'en-US': 'English', 'es-ES': 'Español', 'de-DE': 'Deutsch',
  'it-IT': 'Italiano', 'pt-PT': 'Português', 'zh-CN': '中文', 'ar-SA': 'العربية',
};

function labelFor(code) {
  return LANGUAGE_LABELS[code] || code;
}

// POST /v1/translate
// Body attendu : { text: "...", sourceLang: "fr-FR", targetLang: "en-US" }
router.post('/', async (req, res) => {
  const { text, sourceLang, targetLang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Le champ "text" est requis.' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'Texte trop long pour cette version (limite : 2000 caractères).' });
  }
  if (!sourceLang || !targetLang) {
    return res.status(400).json({ error: 'Les champs "sourceLang" et "targetLang" sont requis.' });
  }

  const prompt =
    `Tu es le module de traduction d'AudyO. Traduis STRICTEMENT le texte suivant de ${labelFor(sourceLang)} ` +
    `vers ${labelFor(targetLang)}. Réponds uniquement avec la traduction, sans aucun commentaire ni guillemets.\n\n` +
    `Texte : ${text}`;

  try {
    const translation = await callClaude(prompt, 400);
    res.json({ translation });
  } catch (err) {
    console.error('[translate]', err.code || '', err.message);
    res.status(502).json({ error: "La traduction n'a pas pu être générée. Réessayez." });
  }
});

module.exports = router;
