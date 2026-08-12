// Seul module du backend qui touche à la clé Anthropic.
// Toute la logique IA (résumé, traduction) passe par ici, jamais directement
// depuis les routes — ça garde un seul point de vérité et un seul endroit
// à auditer pour la conformité RGPD (dossier §6).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_DEFAULT = 'claude-sonnet-4-6';   // résumé, recherche : privilégie la qualité
const MODEL_FAST = 'claude-haiku-4-5-20251001'; // traduction : privilégie la vitesse

async function callClaude(prompt, maxTokens = 800, model = MODEL_DEFAULT) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-votre-cle')) {
    const err = new Error('ANTHROPIC_API_KEY manquante ou non configurée sur le serveur.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Anthropic API a répondu ${response.status}: ${detail}`);
    err.code = 'ANTHROPIC_ERROR';
    throw err;
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!text) {
    const err = new Error('Réponse vide de Claude.');
    err.code = 'EMPTY_RESPONSE';
    throw err;
  }
  return text;
}

module.exports = { callClaude, MODEL_FAST, MODEL_DEFAULT };
