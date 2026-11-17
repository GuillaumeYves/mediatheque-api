# Médiathèque API

API REST d'une médiathèque associative : catalogue d'ouvrages, comptes, emprunts, réservations
et assistant conversationnel. Elle est conçue pour une application mobile et exposée sur Internet.

- **Stack** : Node.js 24, TypeScript strict, Express 5, Zod 4, Prisma 7, PostgreSQL 17, jose, bcrypt, OpenAI.
- **Architecture** : routes déclaratives, services, dépôts et middlewares séparés, gestionnaire d'erreurs central.
- **Documentation** : OpenAPI 3.1 générée depuis les schémas Zod, servie sur `/api/docs`.
- **Sécurité** : JWT court et refresh token révocable, rôles et contrôle de propriété, helmet, CORS, limitation de débit.
- **Qualité** : validation de toutes les entrées, transactions, tests automatisés, intégration continue, image Docker.

## Sommaire

- [Prérequis](#prérequis)
- [Installation locale](#installation-locale)
- [Lancement avec Docker](#lancement-avec-docker)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Variables d'environnement](#variables-denvironnement)
- [Documentation OpenAPI](#documentation-openapi)
- [Authentification](#authentification)
- [Rôles et droits par route](#rôles-et-droits-par-route)
- [Ressources](#ressources)
- [Assistant](#assistant)
- [Sécurité et OWASP API Top 10](#sécurité-et-owasp-api-top-10)
- [Tests et intégration continue](#tests-et-intégration-continue)
- [Architecture](#architecture)
- [Choix techniques](#choix-techniques)

## Prérequis

- Node.js 24 ou plus récent : il exécute directement les fichiers TypeScript, sans étape de compilation en développement.
- Docker et Docker Compose, pour PostgreSQL et l'image de production. Une instance PostgreSQL existante convient aussi.

## Installation locale

```bash
cp .env.example .env          # puis renseigner JWT_ACCESS_SECRET (voir plus bas)
npm ci                        # installe et génère le client Prisma
npm run db:up                 # démarre PostgreSQL dans Docker (bases mediatheque et mediatheque_test)
npm run db:deploy             # applique les migrations
npm run seed                  # 3 comptes, 10 ouvrages, 3 emprunts, 1 réservation
npm run dev                   # API sur http://localhost:3000
```

Vérification : `curl http://localhost:3000/sante` répond `{"statut":"ok","base":"ok"}`.

Si le port 5432 est déjà pris sur la machine, changer `DB_PORT` et le port de `DATABASE_URL` dans `.env`.

| Commande | Effet |
| -------- | ----- |
| `npm run dev` | lance l'API avec rechargement automatique (`node --watch src/index.ts`) |
| `npm start` | lance l'API depuis les sources TypeScript |
| `npm run check` | vérifie les types (`tsc --noEmit`) |
| `npm run build` | compile vers `dist/` |
| `npm run start:prod` | lance la version compilée (`node dist/index.js`) |
| `npm test` | lance les tests sur la base de test |
| `npm run db:up` | démarre PostgreSQL avec Docker Compose |
| `npm run db:migrate` | crée et applique une migration en développement |
| `npm run db:deploy` | applique les migrations en attente |
| `npm run seed` | insère les données de démonstration, rejouable sans doublon |

## Lancement avec Docker

Le `Dockerfile` construit l'image en deux étapes : compilation TypeScript avec toutes les dépendances,
puis image d'exécution avec les seules dépendances de production, sous l'utilisateur non privilégié `node`.
Au démarrage, le conteneur applique les migrations en attente puis lance `node dist/index.js`.

```bash
cp .env.example .env                       # JWT_ACCESS_SECRET obligatoire
docker compose --profile app up --build -d # PostgreSQL et API sur http://localhost:3000
docker compose --profile app exec api node -e "fetch('http://localhost:3000/sante').then(r => r.text()).then(console.log)"
```

Pour les données de démonstration, lancer `npm run seed` depuis la machine hôte, avec `DATABASE_URL` pointant sur la base du conteneur.

L'image seule :

```bash
docker build -t mediatheque-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://app:app@hote-postgres:5432/mediatheque \
  -e JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  -e CORS_ORIGINS=https://app.example.net \
  mediatheque-api
```

## Comptes de démonstration

Créés par `npm run seed`. Adresses et mots de passe **fictifs**, réservés au développement local.

| E-mail | Mot de passe | Rôle |
| ------ | ------------ | ---- |
| `bibliothecaire@example.net` | `Demo-Biblio-2026!` | bibliothecaire |
| `camille@example.net` | `Demo-Camille-2026!` | membre |
| `noe@example.net` | `Demo-Noe-2026!` | membre |

Le seed crée aussi une situation de file d'attente : Camille emprunte « Les Misérables » et Noé l'a réservé.

## Variables d'environnement

| Variable | Rôle | Défaut |
| -------- | ---- | ------ |
| `PORT` | port d'écoute de l'API | `3000` |
| `DATABASE_URL` | chaîne de connexion PostgreSQL | obligatoire |
| `DB_PORT` | port hôte publié par `docker compose` | `5432` |
| `API_PORT` | port hôte de l'API lancée avec `--profile app` | `3000` |
| `JWT_ACCESS_SECRET` | secret de signature des access tokens, 32 caractères au moins | obligatoire |
| `ACCESS_TOKEN_TTL_SECONDS` | durée de vie d'un access token, plafonnée à 900 s | `900` |
| `REFRESH_TOKEN_TTL_DAYS` | durée de vie d'un refresh token | `7` |
| `BCRYPT_COST` | coût bcrypt, jamais inférieur à 12 | `12` |
| `CORS_ORIGINS` | origines autorisées, séparées par des virgules | aucune |
| `AUTH_RATE_LIMIT_MAX` | tentatives par quart d'heure sur `/api/auth/*` | `10` |
| `GLOBAL_RATE_LIMIT_MAX` | requêtes par minute sur toute l'API | `300` |
| `TRUST_PROXY` | nombre de proxys de confiance (adresse IP réelle du client) | `0` |
| `DUREE_EMPRUNT_JOURS` | durée de l'emprunt créé pour une réservation honorée | `14` |
| `IA_FOURNISSEUR` | fournisseur de l'assistant : `bouchon` ou `openai` | `bouchon` |
| `OPENAI_API_KEY` | clé OpenAI, exigée avec `IA_FOURNISSEUR=openai` : sans elle, le serveur refuse de démarrer | aucune |
| `OPENAI_MODELE` | modèle utilisé | `gpt-4.1-mini` |
| `IA_MAX_JETONS_SORTIE` | plafond de jetons générés par réponse | `400` |
| `ASSISTANT_RATE_LIMIT_MAX` | questions par minute et par compte | `10` |
| `IA_BOUCHON_DELAI_MS` | délai entre deux mots diffusés par le bouchon | `40` |
| `IA_QUOTA_JETONS_JOUR` | jetons d'entrée et de sortie autorisés par compte et par jour | `20000` |

`.env` et `.env.test` ne sont jamais versionnés. Les fichiers `.env.example` et `.env.test.example`
ne contiennent que des valeurs factices. La configuration est contrôlée au démarrage : une variable
obligatoire absente ou une valeur hors bornes arrête le processus avec un message explicite.

### Générer un secret

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
# ou
openssl rand -base64 48
```

Un secret par environnement, jamais commité, jamais partagé entre développement, test et production.
Changer le secret invalide immédiatement tous les access tokens en circulation.

## Documentation OpenAPI

| Route | Contenu |
| ----- | ------- |
| `GET /api/docs` | interface Swagger UI |
| `GET /api/docs.json` | spécification OpenAPI 3.1 |

La spécification est générée au démarrage par `zod-openapi`, à partir des **mêmes définitions**
que le routage : chaque route déclare une seule fois son chemin, son accès, ses schémas Zod
d'entrée et ses réponses. Une route ne peut donc pas exister sans être documentée.
Les opérations protégées déclarent le schéma de sécurité `bearerAuth` ; le bouton « Authorize »
de Swagger UI accepte l'access token obtenu à la connexion. Toutes les erreurs suivent le schéma `Erreur`.

## Authentification

L'API utilise deux jetons :

- **access token** : JWT HS256 signé avec jose, valable 15 minutes au plus. Il ne contient que l'identifiant
  (`sub`) et le rôle, jamais d'e-mail ni de mot de passe. Il est envoyé dans `Authorization: Bearer <jeton>`.
- **refresh token** : chaîne aléatoire de 48 octets, valable 7 jours. Seule son empreinte SHA-256 est stockée
  en base, il est révocable à tout moment.

```mermaid
sequenceDiagram
    participant App as Application mobile
    participant API
    participant DB as PostgreSQL

    App->>API: POST /api/auth/connexion {email, motDePasse}
    API->>DB: compte par e-mail
    API->>API: bcrypt.compare (même durée si le compte n'existe pas)
    API->>DB: empreinte du refresh token
    API-->>App: 200 {accessToken, refreshToken, expiresIn}

    App->>API: GET /api/ouvrages + Bearer accessToken
    API->>API: vérification de la signature, de l'émetteur et de l'expiration
    API-->>App: 200

    Note over App,API: après 15 minutes, l'access token expire
    App->>API: POST /api/auth/rafraichir {refreshToken}
    API->>DB: révoque l'ancien refresh token, enregistre le nouveau
    API-->>App: 200 {nouvel accessToken, nouveau refreshToken}

    App->>API: POST /api/auth/deconnexion + Bearer accessToken
    API->>DB: révoque tous les refresh tokens du compte
    API-->>App: 204
```

**Rotation et détection de vol** : chaque rafraîchissement révoque le refresh token utilisé.
Si un jeton déjà révoqué est présenté à nouveau, il a forcément été copié : tous les refresh tokens
du compte sont révoqués et l'utilisateur doit se reconnecter.

| Méthode | Route | Corps | Succès | Erreurs |
| ------- | ----- | ----- | ------ | ------- |
| POST | `/api/auth/inscription` | `email`, `motDePasse` (12 caractères au moins) | 201 | 400, 409, 429 |
| POST | `/api/auth/connexion` | `email`, `motDePasse` | 200 | 400, 401, 429 |
| POST | `/api/auth/rafraichir` | `refreshToken` | 200 | 400, 401, 429 |
| POST | `/api/auth/deconnexion` | aucun | 204 | 401, 429 |
| GET | `/api/auth/moi` | aucun | 200 | 401, 429 |

L'inscription crée toujours un **membre** : un champ `role` envoyé par le client est ignoré.
La connexion renvoie le même 401 que le compte existe ou non.

## Rôles et droits par route

| Route | Anonyme | Membre | Bibliothécaire |
| ----- | :-----: | :----: | :------------: |
| `GET /sante`, `GET /api/docs`, `GET /api/docs.json` | oui | oui | oui |
| `POST /api/auth/inscription`, `/connexion`, `/rafraichir` | oui | oui | oui |
| `POST /api/auth/deconnexion`, `GET /api/auth/moi` | 401 | oui | oui |
| `GET /api/ouvrages`, `GET /api/ouvrages/:id` | 401 | oui (seuls ses emprunts en cours sont joints) | oui |
| `POST`, `PATCH`, `DELETE /api/ouvrages` | 401 | 403 | oui |
| `GET /api/emprunts` | 401 | ses emprunts uniquement | tous |
| `GET /api/emprunts/:id` | 401 | le sien, sinon 404 | tous |
| `POST /api/emprunts` | 401 | pour lui-même | pour lui ou pour un membre (`emprunteurId`) |
| `PATCH /api/emprunts/:id` | 401 | le sien, sinon 404 | tous |
| `POST /api/emprunts/:id/retour` | 401 | le sien, sinon 404 | tous |
| `DELETE /api/emprunts/:id` | 401 | 403 | oui |
| `GET /api/reservations` | 401 | ses réservations uniquement | toutes |
| `GET /api/reservations/:id` | 401 | la sienne, sinon 404 | toutes |
| `POST /api/reservations` | 401 | pour lui-même | pour lui ou pour un membre (`membreId`) |
| `DELETE /api/reservations/:id` (annulation) | 401 | la sienne, sinon 404 | toutes |
| `POST /api/assistant/flux`, `DELETE /api/assistant/memoire` | 401 | ses propres données | ses propres données |

**403 ou 404 sur la ressource d'un autre membre** : l'API répond 404, avec exactement le même corps
que pour un identifiant inexistant. Un 403 confirmerait que l'emprunt ou la réservation existe, ce qui
permettrait d'énumérer les identifiants. Le 403 reste réservé aux actions interdites par le rôle
(un membre qui crée un ouvrage, par exemple), où il n'y a rien à cacher.

Le schéma de `PATCH /api/emprunts/:id` n'accepte que `retourPrevuLe` : ni l'ouvrage, ni le propriétaire,
ni l'état rendu ne peuvent changer par cette route.

## Ressources

Toutes les réponses sont en JSON, sauf le flux de l'assistant. Les listes sont paginées avec `?page=` (défaut 1)
et `?limite=` (défaut 10). Une limite supérieure à 50 est ramenée à 50 plutôt que refusée,
comme le demande le sujet ; le champ `limite` de la réponse indique la valeur appliquée.
Une limite nulle, négative ou non numérique reste refusée en 400.

```json
{ "donnees": [], "page": 1, "limite": 10, "total": 42, "pages": 5 }
```

### Ouvrages

| Méthode | Route | Succès | Erreurs |
| ------- | ----- | ------ | ------- |
| GET | `/api/ouvrages?disponible=true` | 200 | 400, 401 |
| GET | `/api/ouvrages/:id` (avec les emprunts en cours visibles) | 200 | 400, 401, 404 |
| POST | `/api/ouvrages` | 201 | 400, 401, 403 |
| PATCH | `/api/ouvrages/:id` | 200 | 400, 401, 403, 404 |
| DELETE | `/api/ouvrages/:id` | 204 | 400, 401, 403, 404, 409 |

Champs : `titre` (1 à 150 caractères), `auteur` (1 à 120 caractères), `annee` (entier de 1450 à l'année courante).
`disponible` est en lecture seule : il découle des emprunts.
La suppression renvoie 409 si l'ouvrage est emprunté ou s'il a un historique d'emprunts ou de réservations.

### Emprunts

| Méthode | Route | Succès | Erreurs |
| ------- | ----- | ------ | ------- |
| GET | `/api/emprunts?rendu=false&ouvrageId=1` | 200 | 400, 401 |
| GET | `/api/emprunts/:id` | 200 | 400, 401, 404 |
| POST | `/api/emprunts` | 201 | 400, 401, 404, 409 |
| PATCH | `/api/emprunts/:id` | 200 | 400, 401, 404 |
| DELETE | `/api/emprunts/:id` | 204 | 400, 401, 403, 404 |
| POST | `/api/emprunts/:id/retour` | 200 | 400, 401, 404, 409 |

Champs : `ouvrageId`, `emprunteurId` (bibliothécaire uniquement), `empruntLe` (date ISO, maintenant par défaut),
`retourPrevuLe` (date ISO, postérieure à l'emprunt).

Règles :
- créer un emprunt rend l'ouvrage indisponible dans la même transaction ; un ouvrage déjà emprunté renvoie 409 sans rien écrire ;
- le retour clôture l'emprunt et libère l'ouvrage dans la même transaction (voir les réservations) ; un second retour renvoie 409 ;
- supprimer un emprunt en cours libère l'ouvrage de la même façon.

### Réservations

| Méthode | Route | Succès | Erreurs |
| ------- | ----- | ------ | ------- |
| GET | `/api/reservations?statut=active&ouvrageId=1` | 200 | 400, 401 |
| GET | `/api/reservations/:id` | 200 | 400, 401, 404 |
| POST | `/api/reservations` | 201 | 400, 401, 404, 409 |
| DELETE | `/api/reservations/:id` | 204 | 400, 401, 404, 409 |

Une réservation a le statut `active`, `annulee` ou `honoree`. Règles :
- seul un ouvrage **indisponible** se réserve ; un ouvrage disponible renvoie 409 : il suffit de l'emprunter ;
- un membre ne réserve pas un ouvrage qu'il emprunte déjà (409) ;
- **une seule réservation active** par membre et par ouvrage (409). La règle est garantie par un index unique
  sur `(ouvrageId, membreId, enCours)` : `enCours` vaut `true` tant que la réservation est active et `NULL`
  ensuite, et PostgreSQL considère les `NULL` comme distincts. Deux demandes simultanées donnent donc un 201 et un 409 ;
- l'annulation passe la réservation en `annulee` sans la supprimer : l'historique est conservé ;
- **au retour d'un ouvrage**, la plus ancienne réservation active devient un emprunt de `DUREE_EMPRUNT_JOURS` jours
  pour son membre et passe en `honoree`, dans **la même transaction** que la clôture. L'ouvrage reste indisponible
  et la réponse du retour contient cet emprunt dans `empruntSuivant`. Sans réservation, l'ouvrage redevient disponible.

```mermaid
sequenceDiagram
    participant C as Camille
    participant N as Noé
    participant API
    participant DB as PostgreSQL

    N->>API: POST /api/reservations {ouvrageId: 1}
    API->>DB: ouvrage indisponible ? pas déjà emprunté par Noé ?
    API-->>N: 201 réservation active

    C->>API: POST /api/emprunts/1/retour
    API->>DB: BEGIN
    API->>DB: clôture de l'emprunt de Camille
    API->>DB: plus ancienne réservation active de l'ouvrage
    API->>DB: emprunt créé pour Noé, réservation honorée
    API->>DB: COMMIT
    API-->>C: 200 {rendu: true, empruntSuivant: {emprunteurId: Noé}}
```

### Format des erreurs

```json
{
  "erreur": "Données invalides",
  "details": [{ "champ": "body.annee", "message": "Trop petit : nombre doit être >=1450" }]
}
```

| Cause | Statut |
| ----- | ------ |
| validation Zod, identifiant mal formé, JSON invalide | 400 |
| jeton absent, invalide, expiré ou signé par un autre secret | 401 |
| rôle insuffisant, origine CORS non déclarée | 403 |
| ressource absente (dont Prisma `P2025`) ou appartenant à un autre membre | 404 |
| conflit métier, clé étrangère (`P2003`), doublon (`P2002`) | 409 |
| corps JSON de plus de 100 Ko | 413 |
| limite de débit atteinte | 429 |
| erreur inattendue, journalisée côté serveur uniquement | 500 |

Aucune réponse ne contient de pile d'exécution ni de message interne.

### Exemples de requêtes

Le fichier [`requetes.http`](requetes.http) couvre toutes les routes, cas d'erreur compris,
avec l'extension REST Client de VS Code. Avec curl :

```bash
# Connexion
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"noe@example.net","motDePasse":"Demo-Noe-2026!"}' | node -p "JSON.parse(require('fs').readFileSync(0)).accessToken")

# Ouvrages disponibles
curl "http://localhost:3000/api/ouvrages?disponible=true" -H "Authorization: Bearer $TOKEN"

# Emprunter l'ouvrage 2
curl -X POST http://localhost:3000/api/emprunts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ouvrageId": 2, "retourPrevuLe": "2030-01-15"}'

# Mes réservations
curl http://localhost:3000/api/reservations -H "Authorization: Bearer $TOKEN"

# Question à l'assistant : -N affiche le flux au fil de l'eau
curl -N -X POST http://localhost:3000/api/assistant/flux \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"question": "Quelles sont mes réservations ?"}'
```

## Assistant

`POST /api/assistant/flux` reçoit `{"question": "..."}` (500 caractères au plus) et répond en
**Server-Sent Events** (`text/event-stream`) :

```text
event: outil
data: {"outil":"mes_reservations"}

data: {"texte":"Voici "}

data: {"texte":"vos "}

event: fin
data: {"jetons":{"inputTokens":8,"outputTokens":21}}
```

| Événement | Contenu |
| --------- | ------- |
| `message` (par défaut) | `{"texte"}` : un fragment de la réponse |
| `outil` | `{"outil"}` : un outil a été appelé |
| `fin` | `{"jetons"}` : jetons consommés en entrée et en sortie |
| `erreur` | `{"erreur"}` : message neutre si le fournisseur échoue en cours de flux |

Fonctionnement :
- **outils** : `rechercher_ouvrages` (titre ou auteur), `mes_emprunts` et `mes_reservations`. Ils sont construits pour
  l'utilisateur de la requête et **ne prennent aucun identifiant en argument** : l'identité vient du jeton,
  jamais du modèle. Même un bibliothécaire n'y voit que ses propres emprunts et réservations.
  Les arguments produits par le modèle sont validés par Zod comme toute autre entrée ;
- **mémoire** : les 10 derniers échanges par utilisateur, en mémoire du processus ; seul un échange terminé y entre.
  `DELETE /api/assistant/memoire` l'efface ;
- **arrêt** : si le client ferme la connexion, la génération est interrompue (`AbortController`) et l'arrêt est journalisé ;
- **coût** : 10 questions par minute et par compte, réponses plafonnées à `IA_MAX_JETONS_SORTIE` jetons,
  3 tours d'outils au plus par question, jetons journalisés pour chaque réponse ;
- **quota journalier** : chaque réponse ajoute une ligne à la table `consommation_ia` (compte, date, jetons d'entrée
  et de sortie). Le middleware `quotaIa(limiteJetonsParJour)` refuse en 429 le compte qui a atteint
  `IA_QUOTA_JETONS_JOUR` jetons depuis minuit UTC. Avec le bouchon, un jeton vaut quatre caractères.
  Un flux coupé par le client ou en erreur est aussi décompté : le fournisseur facture les jetons déjà générés,
  donc la consommation est estimée (instructions, historique, question et texte déjà diffusé) et le quota
  ne peut pas être contourné en coupant les flux ;
- **fournisseurs** : `openai` utilise l'API Responses en streaming avec appel de fonctions ; `bouchon` choisit l'outil
  par mots-clés et diffuse une réponse construite à partir des vrais résultats, sans réseau ni clé.
  Les routes ignorent quel fournisseur est actif.

> **Mode de test** : l'assistant a été testé uniquement avec le fournisseur `bouchon`, que les tests automatisés
> et la CI utilisent toujours. Le fournisseur `openai` est implémenté mais n'a pas été exécuté avec une clé réelle.

## Sécurité et OWASP API Top 10

| Risque OWASP API | Exemple | Parade dans ce projet |
| ---------------- | ------- | --------------------- |
| API1 Autorisation au niveau des objets cassée | `GET /api/emprunts/42` d'un autre membre | contrôle de propriété dans les services (404, identique à une ressource absente), listes filtrées sur le compte, outils de l'assistant liés à l'identité du jeton |
| API2 Authentification cassée | jetons sans expiration, secret faible | access token de 15 minutes, secret aléatoire de 32 caractères au moins contrôlé au démarrage, rotation et détection de rejeu des refresh tokens, 429 sur `/api/auth` |
| API3 Exposition excessive de données | renvoyer `motDePasseHache` | `select` explicite dans les dépôts, schémas de réponse documentés, emprunts des autres masqués dans le détail d'un ouvrage |
| API4 Consommation de ressources illimitée | corps de 50 Mo, liste non paginée, questions en rafale | JSON limité à 100 Ko, pagination plafonnée à 50, question de 500 caractères, 10 questions par minute, quota de jetons par jour, jetons de sortie plafonnés, flux arrêté à la déconnexion |
| API5 Autorisation au niveau des fonctions cassée | `DELETE /api/ouvrages` ouvert aux membres | accès déclaré sur chaque route (`public`, `authenticated` ou liste de rôles), vérifié avant la validation |
| API6 Affectation en masse | `role: "admin"` à l'inscription | Zod retire les champs inconnus ; `role`, `emprunteurId`, `membreId` ignorés pour un membre ; `PATCH` d'emprunt limité à la date |
| API7 Mauvaise configuration | pile dans les réponses, CORS `*` | gestionnaire d'erreurs central sans pile, helmet, origines CORS explicites, conteneur non privilégié |
| API8 Injection | `where` construit avec un objet, injection de prompt | validation des types par Zod, requêtes paramétrées de Prisma ; les règles d'accès ne reposent pas sur les instructions du modèle mais sur les outils |
| API9 Inventaire incomplet | vieille route `/v1/debug` oubliée | spécification OpenAPI générée depuis les définitions de routes, test qui vérifie la sécurité de chaque opération |
| API10 Consommation non sûre d'API tierces | faire confiance à un service externe | arguments d'outils validés, nombre de tours borné, erreur du fournisseur remplacée par un message neutre, détail au journal |

Autres mesures :

| Mesure | Mise en œuvre |
| ------ | ------------- |
| Mots de passe | bcrypt, coût 12 au minimum, 72 octets au plus ; jamais renvoyés, jamais journalisés |
| Énumération de comptes | même 401 et même durée de réponse que le compte existe ou non |
| Secrets | lus depuis l'environnement, absents du dépôt et de l'image Docker |
| Dépendances | `npm audit --audit-level=high` à chaque pull request ; scripts d'installation autorisés paquet par paquet (`allowScripts`) |

## Tests et intégration continue

Les tests utilisent `node:test` et `fetch` contre l'application démarrée sur un port éphémère (`listen(0)`),
avec une **base distincte** de la base de développement. L'assistant y tourne toujours avec le fournisseur `bouchon`.

```bash
cp .env.test.example .env.test   # adapter le port si besoin
npm test
```

Avant les suites, les migrations sont appliquées sur la base de test. Un garde-fou refuse de lancer
les tests si le nom de la base ne contient pas `test`. Chaque fichier repart d'une base vide.

| Fichier | Couverture |
| ------- | ---------- |
| `test/auth.test.ts` | inscription, doublon, connexion réussie et échouée, jeton absent ou forgé, rotation, vol de refresh token, déconnexion |
| `test/access.test.ts` | 403 sur rôle insuffisant, 404 sur l'emprunt d'un autre membre identique à un emprunt absent, plafond de `?limite=`, PATCH sans changement de propriétaire |
| `test/hardening.test.ts` | en-têtes helmet, CORS, 413, réponse sans pile, 429 à la onzième tentative |
| `test/reservations.test.ts` | réservation d'un ouvrage indisponible, 409 (disponible, déjà emprunté, doublon simultané), passage au suivant lors du retour, annulation, droits |
| `test/assistant.test.ts` | 401, 400, flux SSE (`data:` puis `event: fin`), appel d'outil, isolation des emprunts entre membres, mémoire, 429 |
| `test/assistant-quota.test.ts` | réponse du bouchon en cinquante mots, ligne `consommation_ia` par réponse, 429 au-delà du quota du jour, quota propre à chaque compte |
| `test/assistant-units.test.ts` | validation des arguments d'outils, outils restreints au compte connecté, mémoire tronquée par utilisateur |
| `test/openapi.test.ts` | `/api/docs.json` en 3.1, couverture des ressources, `bearerAuth` sur chaque opération protégée, Swagger UI |

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) s'exécute à chaque pull request :
service PostgreSQL, `npm ci`, `npm audit --audit-level=high`, `npm run check`, `npm test`, `npm run build`
et construction de l'image Docker. Le secret JWT de la CI est généré à chaque exécution.

## Architecture

```
prisma/
  schema.prisma            modèles Utilisateur, RefreshToken, Ouvrage, Emprunt, Reservation
  migrations/              historique SQL versionné
  seed.ts, seed-data.ts    seeder rejouable et ses données
prisma.config.ts           connexion, migrations et commande de seed
src/
  index.ts                 démarrage et arrêt propre
  app.ts                   assemblage : services, sécurité, documentation, groupes de routes, erreurs
  config.ts                lecture et contrôle de l'environnement, type Config
  erreurs.ts               HttpError et traduction des erreurs Prisma, jose et body-parser
  types/express.d.ts       req.utilisateur, par déclaration globale
  domain/                  rôles et types partagés
  db/prisma.ts             client Prisma avec l'adaptateur pg
  security/                hachage des mots de passe, émission et vérification des jetons
  http/
    route.ts               defineRoute et montage : accès, middlewares, validation Zod, handler
    openapi.ts             génération de la spécification depuis les routes
    responses.ts           réponses d'erreur communes
    sse.ts                 flux Server-Sent Events
  routes/                  un groupe déclaratif par ressource, HTTP uniquement
  services/                règles métier, droits de propriété et transactions
    assistant/             fournisseurs OpenAI et bouchon, outils, mémoire, orchestration
  repositories/            requêtes Prisma, seul endroit qui parle à la base
  schemas/                 schémas Zod d'entrée et de réponse ; les types TypeScript en sont dérivés
  middlewares/             authentification, sécurité, journal, erreurs
test/                      tests d'intégration et unitaires, contexte partagé
docker/                    initialisation de la base de test
Dockerfile                 image de production en deux étapes
requetes.http              scénarios de test manuels
```

Le flux d'une requête : **sécurité** (helmet, CORS, débit) puis **authentification** et **rôle** puis
**validation Zod** puis **handler** puis **service** (règles métier et propriété) puis **dépôt** (Prisma).

Chaque route est décrite une seule fois avec `defineRoute` :

```ts
defineRoute({
  method: "post",
  path: "/",
  summary: "Réserver un ouvrage indisponible",
  access: "authenticated",
  body: createReservationSchema,
  responses: { 201: { description: "Réservation créée", schema: reservationSchema }, ...errors(400, 401, 404, 409) },
  handler: async ({ body, user }) => created(await reservationService.create(body, user)),
});
```

Le handler reçoit `body`, `params` et `query` déjà validés et typés à partir des schémas.
La même définition sert au routeur Express et à la spécification OpenAPI.

`app.ts` reçoit le client Prisma et la configuration en paramètres et ne démarre pas de serveur :
les tests construisent ainsi une application par suite, avec leurs propres limites.

## Choix techniques

- **TypeScript sans compilation en développement** : Node.js 24 exécute les fichiers `.ts` en retirant les types.
  Le projet s'en tient donc à la syntaxe effaçable (`erasableSyntaxOnly` : pas d'`enum` ni de `namespace` à l'exécution)
  et importe les fichiers avec leur extension `.ts`, réécrite en `.js` par `tsc` pour la version compilée.
- **Types dérivés de Zod** : `z.output<typeof schema>` évite de maintenir un type et un schéma en parallèle.
- **Routes déclaratives** : une seule source pour le routage, la validation, les droits et la documentation.
  L'inventaire de l'API ne peut pas diverger de sa documentation.
- **PostgreSQL et Prisma** : les emprunts et les réservations demandent des transactions et des contraintes fiables.
  Prisma apporte des migrations versionnées et un client typé.
- **bcrypt** : implémentation native exécutée dans le pool de threads de libuv, la boucle d'événements
  reste disponible pendant un hachage.
- **Refresh token opaque** : un simple aléa stocké en empreinte suffit, puisqu'il est toujours vérifié en base.
- **Concurrence** : l'ouvrage est réservé par une mise à jour conditionnelle (`disponible = true`) ;
  deux emprunts simultanés du même ouvrage donnent un 201 et un 409. L'index unique des réservations actives
  et la clôture conditionnelle (`statut = active`) appliquent le même principe.
- **SSE plutôt que WebSocket** : la réponse ne va que du serveur vers le client, sur une requête HTTP ordinaire,
  compatible avec l'authentification Bearer et la limitation de débit existantes.
- **Fournisseur bouchon** : il exerce les vrais outils, donc les vraies règles d'accès, sans coût ni réseau ;
  les tests restent rapides et déterministes.
- **Mémoire en processus** : suffisante pour une instance unique ; plusieurs instances demanderaient un stockage partagé.
- **Image Docker** : `node:24-slim` avec OpenSSL pour le moteur de migration de Prisma, dépendances de développement
  retirées par `npm prune`, migrations appliquées au démarrage, `exec` pour que Node reçoive `SIGTERM`.
