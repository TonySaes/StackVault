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
│   ├── api/   # Backend NestJS, initialise dans une story dediee
│   └── web/   # Frontend React/Vite, initialise dans une story dediee
├── docs/      # Documentation projet 
└── package.json
```

Les dossiers `apps/api` et `apps/web` sont volontairement minimaux pour l'instant. Ils existent pour poser le workspace; les starters NestJS et React/Vite seront ajoutes par les prochaines stories.

## Commandes

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Ces commandes existent des le socle du projet. Tant que les applications ne sont pas initialisees, elles executent des controles temporaires sans logique metier.

## Frontieres actuelles

Cette initialisation ne contient pas encore:

- API NestJS;
- frontend React/Vite;
- base PostgreSQL ou Prisma;
- authentification;
- dashboard public;
- pipeline de CI/CD.
