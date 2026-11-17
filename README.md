# Médiathèque API

API REST d'une médiathèque associative : gestion du catalogue d'ouvrages et des emprunts,
pensée pour être consommée par une future application mobile.

- **Stack** : Node.js 24, Express 5, Zod 4, Prisma 7, PostgreSQL 17.
- **Architecture** : routes, services, dépôts et middlewares séparés, gestionnaire d'erreurs central.
- **Garanties** : validation de toutes les entrées, emprunts atomiques, seeder rejouable, aucune pile d'exécution exposée.

## Sommaire

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Routes](#routes)
- [Exemples de requêtes](#exemples-de-requêtes)
- [Architecture](#architecture)
- [Choix techniques](#choix-techniques)

## Prérequis

- Node.js 24 ou plus récent.
- Docker et Docker Compose, pour PostgreSQL. Une instance PostgreSQL existante convient aussi.

## Installation

```bash
cp .env.example .env          # puis adapter si besoin
npm ci                        # installe et génère le client Prisma
npm run db:up                 # démarre PostgreSQL dans Docker
npx prisma migrate deploy     # applique les migrations
npm run seed                  # 10 ouvrages, 3 emprunts dont 1 rendu
npm run dev                   # API sur http://localhost:3000
```

Vérification : `curl http://localhost:3000/sante` répond `{"statut":"ok","base":"ok"}`.

Si le port 5432 est déjà pris sur la machine, changer `DB_PORT` et le port de `DATABASE_URL` dans `.env`.

## Variables d'environnement

| Variable | Rôle | Exemple |
| -------- | ---- | ------- |
| `PORT` | port d'écoute de l'API | `3000` |
| `DATABASE_URL` | chaîne de connexion PostgreSQL | `postgresql://app:app@localhost:5432/mediatheque` |
| `DB_PORT` | port hôte publié par `docker compose` | `5432` |

Le fichier `.env` n'est jamais versionné. `.env.example` ne contient que des valeurs de développement.

## Scripts

| Commande | Effet |
| -------- | ----- |
| `npm run dev` | lance l'API avec rechargement automatique |
| `npm start` | lance l'API |
| `npm run db:up` | démarre PostgreSQL avec Docker Compose |
| `npm run db:migrate` | crée et applique une migration en développement |
| `npm run db:deploy` | applique les migrations en attente |
| `npm run seed` | insère les données de démonstration, rejouable sans doublon |

## Routes

Toutes les réponses sont en JSON. Les listes sont paginées avec `?page=` (défaut 1) et `?limite=` (défaut 10, 50 au plus).

```json
{ "donnees": [], "page": 1, "limite": 10, "total": 42, "pages": 5 }
```

### Ouvrages

| Méthode | Route | Succès | Erreurs |
| ------- | ----- | ------ | ------- |
| GET | `/api/ouvrages?disponible=true` | 200 | 400 |
| GET | `/api/ouvrages/:id` (avec les emprunts en cours) | 200 | 400, 404 |
| POST | `/api/ouvrages` | 201 | 400 |
| PATCH | `/api/ouvrages/:id` | 200 | 400, 404 |
| DELETE | `/api/ouvrages/:id` | 204 | 400, 404, 409 |

Champs : `titre` (1 à 150 caractères), `auteur` (1 à 120 caractères), `annee` (entier de 1450 à l'année courante).
`disponible` est en lecture seule : il découle des emprunts.
La suppression renvoie 409 si l'ouvrage est emprunté ou s'il a un historique d'emprunts.

### Emprunts

| Méthode | Route | Succès | Erreurs |
| ------- | ----- | ------ | ------- |
| GET | `/api/emprunts?rendu=false&ouvrageId=1` | 200 | 400 |
| GET | `/api/emprunts/:id` | 200 | 400, 404 |
| POST | `/api/emprunts` | 201 | 400, 404, 409 |
| PATCH | `/api/emprunts/:id` | 200 | 400, 404 |
| DELETE | `/api/emprunts/:id` | 204 | 400, 404 |
| POST | `/api/emprunts/:id/retour` | 200 | 400, 404, 409 |

Champs : `ouvrageId`, `emprunteur` (2 à 80 caractères), `empruntLe` (date ISO, maintenant par défaut),
`retourPrevuLe` (date ISO, postérieure à l'emprunt). Seuls `emprunteur` et `retourPrevuLe` sont modifiables.

Règles :
- créer un emprunt rend l'ouvrage indisponible dans la même transaction ; un ouvrage déjà emprunté renvoie 409 sans rien écrire ;
- le retour marque l'emprunt rendu et l'ouvrage disponible ensemble ; un second retour renvoie 409 ;
- supprimer un emprunt en cours libère l'ouvrage.

### Divers

| Méthode | Route | Succès |
| ------- | ----- | ------ |
| GET | `/sante` | 200, ou 503 si la base ne répond pas |
| * | toute route inconnue | 404 |

### Format des erreurs

```json
{
  "erreur": "Données invalides",
  "details": [
    { "champ": "body.annee", "message": "Trop petit : nombre doit être >=1450" }
  ]
}
```

| Cause | Statut |
| ----- | ------ |
| validation Zod, identifiant mal formé, JSON invalide | 400 |
| ressource absente (dont Prisma `P2025`) | 404 |
| conflit métier, clé étrangère (`P2003`), doublon (`P2002`) | 409 |
| erreur inattendue (journalisée côté serveur uniquement) | 500 |

## Exemples de requêtes

Le fichier [`requetes.http`](requetes.http) couvre toutes les routes, cas d'erreur compris,
avec l'extension REST Client de VS Code. Quelques exemples avec curl :

```bash
# Ouvrages disponibles
curl "http://localhost:3000/api/ouvrages?disponible=true&limite=5"

# Emprunter l'ouvrage 2
curl -X POST http://localhost:3000/api/emprunts \
  -H "Content-Type: application/json" \
  -d '{"ouvrageId": 2, "emprunteur": "Lucas", "retourPrevuLe": "2030-01-15"}'

# Rendre l'emprunt 4
curl -X POST http://localhost:3000/api/emprunts/4/retour
```

## Architecture

```
prisma/
  schema.prisma          modèles Ouvrage et Emprunt
  migrations/            historique SQL versionné
  seed.js, seed-data.js  seeder rejouable et ses données
prisma.config.ts         connexion, migrations et commande de seed
src/
  index.js               démarrage et arrêt propre
  app.js                 assemblage : middlewares, routeurs, 404, erreurs
  config.js              lecture et contrôle de l'environnement
  erreurs.js             HttpError et traduction des erreurs Prisma
  db/prisma.js           client Prisma avec l'adaptateur pg
  routes/                un routeur par ressource, HTTP uniquement
  services/              règles métier et transactions
  repositories/          requêtes Prisma, seul endroit qui parle à la base
  schemas/               schémas Zod partagés et par ressource
  middlewares/           validation, journal, 404 et gestionnaire d'erreurs
requetes.http            scénarios de test manuels
```

Le flux d'une requête : **route** (validation Zod) puis **service** (règles métier) puis **dépôt** (Prisma).
Les dépôts acceptent le client Prisma ou un client de transaction : un service peut ainsi enchaîner
plusieurs dépôts dans une même transaction sans dupliquer de requête.

`app.js` reçoit le client Prisma en paramètre et ne démarre pas de serveur : l'application se teste
avec n'importe quelle base.

## Choix techniques

- **PostgreSQL et Prisma** : les emprunts demandent des transactions et une clé étrangère fiables,
  le relationnel s'impose. Prisma apporte des migrations versionnées et un client typé.
- **Concurrence** : l'ouvrage est réservé par une mise à jour conditionnelle (`disponible = true`).
  Deux emprunts simultanés du même ouvrage donnent un 201 et un 409, jamais deux emprunts.
- **Suppression protégée** : `onDelete: Restrict` conserve l'historique ; la base elle-même refuse
  de supprimer un ouvrage lié à des emprunts.
- **Seeder** : `upsert` sur des identifiants fixes, puis recalage des séquences PostgreSQL
  pour que les créations suivantes ne réutilisent pas ces identifiants.
- **Validation** : les champs inconnus sont ignorés, les messages sont en français et chaque champ fautif est nommé.
