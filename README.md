# AudyO — Backend

Petit serveur Express qui porte toute la logique IA (résumé, traduction) pour
le compte de l'app mobile et du prototype web — c'est la seule pièce qui
détient la clé d'API Anthropic (dossier technique §4.3 et §6 — RGPD).

## Démarrer en local

```bash
npm install
cp .env.example .env
```

Ouvrez `.env` et remplacez `ANTHROPIC_API_KEY` par votre vraie clé
(récupérable sur https://console.anthropic.com).

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`. Testez :

```bash
curl http://localhost:3000/health
# -> {"status":"ok"}
```

## Endpoints disponibles

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |
| POST | `/v1/conversations/summary` | `{ segments: [{ speaker: 0, text: "..." }] }` | `{ summary: "..." }` |
| POST | `/v1/translate` | `{ text, sourceLang, targetLang }` (codes type `fr-FR`) | `{ translation: "..." }` |

## Brancher le prototype web ou l'app mobile dessus

- **Prototype web** (`audyo-prototype-complet.html`) : la constante
  `BACKEND_URL` en haut de chaque module JS pointe vers
  `http://localhost:3000` par défaut — changez-la si votre serveur tourne
  ailleurs (ex. une fois déployé).
- **App mobile** (`AudyO-app`) : `services/api.js` pointe vers
  `https://api.audyo.app` (URL fictive) — remplacez-la par l'URL réelle de
  votre backend déployé, et ajoutez l'équivalent d'un `translateText()` sur
  le même modèle que `requestConversationSummary()`.

## Ce qui manque encore avant la production

- **Authentification** : aujourd'hui n'importe qui connaissant l'URL peut
  appeler ces routes. Il faut ajouter une vérification de compte utilisateur
  (ex. jeton JWT) avant tout appel IA.
- **Persistance** : l'historique sécurisé chiffré (dossier §3.8) n'existe pas
  encore côté serveur — ce backend ne fait aujourd'hui que transformer du
  texte, il ne stocke rien.
- **Déploiement réel** : ce serveur tourne uniquement en local pour l'instant.
  Pour le rendre accessible depuis un vrai téléphone, il faut le déployer
  (ex. Railway, Render, Fly.io, ou votre infra existante) et mettre à jour
  `ALLOWED_ORIGINS` dans `.env` avec le domaine réel de l'app.
- **Limite de débit par utilisateur** : la limite actuelle (30 requêtes/min)
  est globale, pas par utilisateur — à revoir une fois l'auth en place.
