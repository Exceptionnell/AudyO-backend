const express = require('express');
const { transcribeWithLanguageDetection } = require('../services/assemblyai');
const { callClaude, MODEL_FAST } = require('../services/claude');

const router = express.Router();

// Table de correspondance entre les codes BCP-47 utilisés côté app (ex. "fr-FR")
// et les codes ISO courts attendus par AssemblyAI (ex. "fr"), plus les libellés
// humains pour construire le prompt de traduction.
const LANG_MAP = {
  'fr-FR': { short: 'fr', label: 'Français' },
  'en-US': { short: 'en', label: 'English' },
  'es-ES': { short: 'es', label: 'Español' },
  'de-DE': { short: 'de', label: 'Deutsch' },
  'it-IT': { short: 'it', label: 'Italiano' },
  'pt-PT': { short: 'pt', label: 'Português' },
  'zh-CN': { short: 'zh', label: '中文' },
  'ar-SA': { short: 'ar', label: 'العربية' },
};

function shortToFull(shortCode) {
  const entry = Object.entries(LANG_MAP).find(([, v]) => v.short === shortCode);
  return entry ? entry[0] : shortCode;
}
function labelFor(fullCode) {
  return LANG_MAP[fullCode] ? LANG_MAP[fullCode].label : fullCode;
}

// POST /v1/translate-audio
// Body : { audioBase64, langA, langB }  (langA/langB au format "fr-FR")
// Retourne : { text, detectedLang, translation, targetLang }
router.post('/', async (req, res) => {
  const { audioBase64, langA, langB } = req.body || {};

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Le champ "audioBase64" est requis.' });
  }
  if (!langA || !langB || !LANG_MAP[langA] || !LANG_MAP[langB]) {
    return res.status(400).json({ error: 'Les champs "langA" et "langB" sont requis et doivent être des langues supportées.' });
  }
  // ~2 minutes de audio/webm à débit courant ; garde-fou large pour éviter les abus.
  if (audioBase64.length > 8_000_000) {
    return res.status(400).json({ error: 'Extrait audio trop long pour cette version.' });
  }

  let buffer;
  try {
    buffer = Buffer.from(audioBase64, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'Audio invalide (base64 mal formé).' });
  }

  try {
    const expectedShort = [LANG_MAP[langA].short, LANG_MAP[langB].short];
    const transcription = await transcribeWithLanguageDetection(buffer, expectedShort);

    const text = (transcription.text || '').trim();
    if (!text) {
      return res.status(200).json({ text: '', detectedLang: null, translation: '', targetLang: null, empty: true });
    }

    const detectedFull = shortToFull(transcription.languageCode) || langA;
    const targetFull = detectedFull === langA ? langB : langA;

    const prompt =
      `Tu es le module de traduction d'AudyO. Traduis STRICTEMENT le texte suivant de ${labelFor(detectedFull)} ` +
      `vers ${labelFor(targetFull)}. Réponds uniquement avec la traduction, sans aucun commentaire ni guillemets.\n\n` +
      `Texte : ${text}`;
    const translation = await callClaude(prompt, 200, MODEL_FAST);

    res.json({ text, detectedLang: detectedFull, translation, targetLang: targetFull });
  } catch (err) {
    console.error('[translate-audio]', err.code || '', err.message);
    const status = err.code === 'MISSING_ASSEMBLYAI_KEY' ? 500 : 502;
    res.status(status).json({ error: "La transcription automatique n'a pas pu aboutir. Réessayez." });
  }
});

module.exports = router;
