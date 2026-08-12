const express = require('express');
const { callClaude, MODEL_DEFAULT } = require('../services/claude');

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
// Mode classique : { text, sourceLang, targetLang } -> { translation }
// Mode conversation bilingue (détection automatique) : { text, langA, langB } -> { translation, detectedLang }
router.post('/', async (req, res) => {
  const { text, sourceLang, targetLang, langA, langB } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Le champ "text" est requis.' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'Texte trop long pour cette version (limite : 2000 caractères).' });
  }

  // Mode conversation bilingue : on ne sait pas qui parle, on laisse le modèle
  // identifier la langue parmi les deux choisies pour la conversation.
  if (langA && langB) {
    const labelA = labelFor(langA);
    const labelB = labelFor(langB);
    const prompt =
      `Tu es le module de traduction d'AudyO, en mode conversation bilingue. Une conversation se déroule ` +
      `entre deux personnes, l'une parlant ${labelA}, l'autre ${labelB}. Voici une phrase transcrite ; ` +
      `détermine dans laquelle de ces deux langues elle est réellement écrite, puis traduis-la vers l'autre. ` +
      `Réponds STRICTEMENT avec un objet JSON valide, sans texte autour, au format : ` +
      `{"detectedLang": "${labelA}" ou "${labelB}", "translation": "..."}\n\n` +
      `Phrase : ${text}`;
    try {
      const raw = await callClaude(prompt, 300, MODEL_DEFAULT);
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
      const parsed = JSON.parse(cleaned);
      if (!parsed.translation || !parsed.detectedLang) throw new Error('Réponse JSON incomplète.');
      const detectedCode = parsed.detectedLang === labelA ? langA : parsed.detectedLang === labelB ? langB : null;
      res.json({ translation: parsed.translation, detectedLang: detectedCode || langA, detectedLabel: parsed.detectedLang });
    } catch (err) {
      console.error('[translate:auto]', err.code || '', err.message);
      res.status(502).json({ error: "La traduction n'a pas pu être générée. Réessayez." });
    }
    return;
  }

  // Mode classique (langue source/cible fixes).
  if (!sourceLang || !targetLang) {
    return res.status(400).json({ error: 'Les champs "sourceLang"/"targetLang" ou "langA"/"langB" sont requis.' });
  }

  const prompt =
    `Tu es le module de traduction d'AudyO. Traduis STRICTEMENT le texte suivant de ${labelFor(sourceLang)} ` +
    `vers ${labelFor(targetLang)}. Réponds uniquement avec la traduction, sans aucun commentaire ni guillemets.\n\n` +
    `Texte : ${text}`;

  try {
    const translation = await callClaude(prompt, 300, MODEL_DEFAULT);
    res.json({ translation });
  } catch (err) {
    console.error('[translate]', err.code || '', err.message);
    res.status(502).json({ error: "La traduction n'a pas pu être générée. Réessayez." });
  }
});

module.exports = router;
