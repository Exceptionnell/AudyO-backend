const express = require('express');
const { callClaude } = require('../services/claude');

const router = express.Router();

// POST /v1/conversations/summary
// Body attendu : { segments: [{ speaker: 0, text: "..." }, ...] }
router.post('/summary', async (req, res) => {
  const { segments, mode } = req.body || {};

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Le champ "segments" est requis et ne doit pas être vide.' });
  }
  if (segments.length > 500) {
    return res.status(400).json({ error: 'Transcription trop longue pour cette version (limite : 500 segments).' });
  }

  const transcriptText = segments
    .map((s) => {
      const label = typeof s.speaker === 'string' ? s.speaker : `Locuteur ${(s.speaker ?? 0) + 1}`;
      return `${label}: ${String(s.text || '').slice(0, 2000)}`;
    })
    .join('\n');

  const prompt = mode === 'medical'
    ? "Tu es le module d'interprétation IA d'AudyO, en mode Rendez-vous médical. " +
      "Voici la transcription brute d'une consultation. Rédige en français un résumé structuré ainsi :\n" +
      '1. Motif de la consultation\n2. Diagnostic ou éléments évoqués par le professionnel de santé\n' +
      '3. Prescriptions ou traitements mentionnés (ou "Aucun" si non applicable)\n' +
      '4. Prochaines étapes (examens, rendez-vous de suivi, actions pour le patient)\n\n' +
      'Précise en une phrase, en fin de résumé, que ce résumé est une aide-mémoire et ne remplace pas l\'avis du professionnel de santé.\n\n' +
      'Transcription :\n' + transcriptText
    : "Tu es le module d'interprétation IA d'AudyO, une application d'aide à la communication. " +
      "Voici la transcription brute d'une conversation, avec des locuteurs identifiés par numéro " +
      "(l'identification peut être imprécise). Rédige en français un résumé clair et bref, structuré ainsi :\n" +
      '1. Points clés (3 à 5 puces)\n2. Décisions prises (ou "Aucune" si non applicable)\n' +
      '3. Questions en suspens / actions à faire\n\nTranscription :\n' + transcriptText;

  try {
    const summary = await callClaude(prompt, 800);
    res.json({ summary });
  } catch (err) {
    console.error('[summary]', err.code || '', err.message);
    res.status(502).json({ error: "Le résumé n'a pas pu être généré. Réessayez." });
  }
});

module.exports = router;
