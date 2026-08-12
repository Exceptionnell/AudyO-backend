// Service de transcription avec détection automatique de langue, pour le
// mode conversation bilingue mains-libres (dossier §3.3 — module Traduction).
// Contrairement à la reconnaissance vocale du navigateur (une seule langue
// fixée à l'avance), ce service détecte réellement la langue depuis l'audio.

const UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';
const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 15000;

function getApiKey() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    const err = new Error('ASSEMBLYAI_API_KEY manquante — détection automatique de langue indisponible.');
    err.code = 'MISSING_ASSEMBLYAI_KEY';
    throw err;
  }
  return key;
}

async function uploadAudio(buffer) {
  const apiKey = getApiKey();
  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { authorization: apiKey },
    body: buffer,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Échec de l'envoi audio à AssemblyAI (${response.status}): ${detail}`);
    err.code = 'ASSEMBLYAI_UPLOAD_ERROR';
    throw err;
  }
  const data = await response.json();
  return data.upload_url;
}

async function submitTranscript(audioUrl, expectedLanguages) {
  const apiKey = getApiKey();
  const response = await fetch(TRANSCRIPT_URL, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_detection: true,
      language_detection_options: {
        expected_languages: expectedLanguages,
        fallback_language: expectedLanguages[0],
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Échec de la soumission à AssemblyAI (${response.status}): ${detail}`);
    err.code = 'ASSEMBLYAI_SUBMIT_ERROR';
    throw err;
  }
  const data = await response.json();
  return data.id;
}

async function pollTranscript(id) {
  const apiKey = getApiKey();
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const response = await fetch(`${TRANSCRIPT_URL}/${id}`, {
      headers: { authorization: apiKey },
    });
    if (!response.ok) {
      const err = new Error(`Échec de la lecture du résultat AssemblyAI (${response.status})`);
      err.code = 'ASSEMBLYAI_POLL_ERROR';
      throw err;
    }
    const data = await response.json();
    if (data.status === 'completed') return data;
    if (data.status === 'error') {
      const err = new Error(data.error || 'Transcription AssemblyAI en erreur.');
      err.code = 'ASSEMBLYAI_TRANSCRIPT_ERROR';
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  const err = new Error('Délai de transcription dépassé.');
  err.code = 'ASSEMBLYAI_TIMEOUT';
  throw err;
}

// Transcrit un extrait audio en détectant automatiquement laquelle des
// langues attendues (ex. ["fr", "en"]) est parlée.
// Retourne { text, languageCode, languageConfidence }.
async function transcribeWithLanguageDetection(buffer, expectedLanguages) {
  const audioUrl = await uploadAudio(buffer);
  const id = await submitTranscript(audioUrl, expectedLanguages);
  const result = await pollTranscript(id);
  return {
    text: result.text || '',
    languageCode: result.language_code || expectedLanguages[0],
    languageConfidence: result.language_confidence ?? null,
  };
}

module.exports = { transcribeWithLanguageDetection };
