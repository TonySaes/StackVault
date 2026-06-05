import type { IngestionItem } from './ingestion-item.js';

// Demo ingestion dataset
// These local items exercise the ingestion -> normalization -> public resource
// loop without fetching external feeds or storing complete third-party bodies.
export const demoIngestionItems: IngestionItem[] = [
  {
    title: 'React Compiler atteint le statut release candidate',
    sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
    source: {
      name: 'React Blog',
      url: 'https://react.dev/blog',
      type: 'public_metadata',
    },
    candidateCategory: 'release',
    candidateTechnologies: ['React'],
    publishedAt: '2025-04-21T00:00:00.000Z',
    shortSummary:
      'Le compilateur React progresse vers une adoption stable avec des optimisations automatiques.',
  },
  {
    title: 'Node.js publie des informations de securite pour les versions actives',
    sourceUrl: 'https://nodejs.org/en/blog/vulnerability',
    source: {
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
    },
    candidateCategory: 'security',
    candidateTechnologies: ['Node.js'],
    publishedAt: '2025-05-14T00:00:00.000Z',
    shortSummary:
      'Les mainteneurs Node.js documentent les correctifs de securite et les versions a surveiller.',
  },
  {
    title: 'PostgreSQL confirme sa place dans les stacks applicatives modernes',
    sourceUrl:
      'https://www.postgresql.org/about/news/postgresql-adoption-trend',
    source: {
      name: 'PostgreSQL News',
      url: 'https://www.postgresql.org/about/news/',
      type: 'public_metadata',
    },
    candidateCategory: 'trend',
    candidateTechnologies: ['PostgreSQL'],
    publishedAt: '2025-05-01T00:00:00.000Z',
    shortSummary:
      'PostgreSQL reste un choix solide pour les applications relationnelles et les plateformes gerees.',
  },
];
