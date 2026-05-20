# StackVault

StackVault est une application web de veille technique pour developpeurs. Le projet est organise en monorepo afin de separer clairement le frontend, le backend et la documentation.

## Prerequis

- Node.js 22.13 ou plus recent. Node.js 24 LTS est recommande.
- npm 10 ou plus recent.

```bash
npm install
```

Copiez les fichiers d'exemple d'environnement avant de lancer les services locaux:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

## Structure

```text
.
├── apps/
│   ├── api/   # Backend NestJS minimal
│   └── web/   # Frontend React/Vite minimal
├── docs/      # Documentation projet 
└── package.json
```

Les dossiers `apps/api` et `apps/web` contiennent les socles minimaux backend et frontend. Les fonctionnalites metier seront ajoutees par increments dedies.

## Commandes

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Ces commandes existent des le socle du projet. Les scripts encore temporaires indiquent explicitement les zones non initialisees.

## API locale

L'API NestJS vit dans `apps/api`.

```bash
npm run -w apps/api dev
```

Par defaut, l'API ecoute `127.0.0.1:3000`.

```text
GET http://127.0.0.1:3000/api/v1/health
```

La variable `PORT` permet de changer le port. La variable `HOST` permet de changer l'adresse d'ecoute, par exemple `0.0.0.0` dans un environnement de deploiement.

## Base locale

PostgreSQL tourne via Docker Compose.

```bash
docker compose up -d postgres
npm run -w apps/api prisma:generate
npm run -w apps/api prisma:db:push
```

La connexion API utilise `DATABASE_URL` depuis `apps/api/.env`. Le endpoint `GET /api/v1/health` indique si l'API est demarree et si PostgreSQL est joignable.

Si PostgreSQL est indisponible, le endpoint repond en HTTP `503 Service Unavailable`.

Si le port local `5432` est deja utilise, lancez PostgreSQL sur un autre port et adaptez `DATABASE_URL`:

```bash
POSTGRES_PORT=5433 docker compose up -d postgres
```

Dans ce cas, adaptez aussi `DATABASE_URL` dans `apps/api/.env` pour utiliser le port `5433`.

## Frontend local

Le frontend React/Vite vit dans `apps/web`.

```bash
npm run -w apps/web dev
```

Par defaut, Vite sert l'application sur:

```text
http://127.0.0.1:5173/
```

## Frontieres actuelles

Cette initialisation ne contient pas encore:

- authentification;
- dashboard public;
- pipeline de CI/CD.
