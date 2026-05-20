# StackVault

StackVault est une application web de veille technique pour developpeurs. Le projet est organise en monorepo afin de separer clairement le frontend, le backend et la documentation.

## Prerequis

- Node.js 22.13 ou plus recent. Node.js 24 LTS est recommande.
- npm 10 ou plus recent.

```bash
npm install
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

- base PostgreSQL ou Prisma;
- authentification;
- dashboard public;
- pipeline de CI/CD.
