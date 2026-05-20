import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoCategories = [
  {
    name: 'Security',
    slug: 'security',
    signalType: 'security',
  },
  {
    name: 'Release',
    slug: 'release',
    signalType: 'release',
  },
  {
    name: 'Trend',
    slug: 'trend',
    signalType: 'trend',
  },
];

const demoTechnologies = [
  {
    name: 'React',
    slug: 'react',
    status: 'active',
  },
  {
    name: 'Node.js',
    slug: 'nodejs',
    status: 'active',
  },
  {
    name: 'PostgreSQL',
    slug: 'postgresql',
    status: 'active',
  },
  {
    name: 'Prisma',
    slug: 'prisma',
    status: 'active',
  },
];

const demoSources = [
  {
    name: 'React Blog',
    url: 'https://react.dev/blog',
    type: 'public_metadata',
    status: 'active',
  },
  {
    name: 'Node.js Blog',
    url: 'https://nodejs.org/en/blog',
    type: 'public_metadata',
    status: 'active',
  },
  {
    name: 'PostgreSQL News',
    url: 'https://www.postgresql.org/about/news/',
    type: 'public_metadata',
    status: 'active',
  },
  {
    name: 'Prisma Blog',
    url: 'https://www.prisma.io/blog',
    type: 'public_metadata',
    status: 'active',
  },
];

async function main() {
  for (const category of demoCategories) {
    await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
        signalType: category.signalType,
      },
      create: category,
    });
  }

  for (const technology of demoTechnologies) {
    await prisma.technology.upsert({
      where: {
        slug: technology.slug,
      },
      update: {
        name: technology.name,
        status: technology.status,
      },
      create: technology,
    });
  }

  for (const source of demoSources) {
    await prisma.source.upsert({
      where: {
        url: source.url,
      },
      update: {
        name: source.name,
        type: source.type,
        status: source.status,
      },
      create: source,
    });
  }

  console.log(
    `Seeded ${demoCategories.length} categories, ${demoTechnologies.length} technologies and ${demoSources.length} sources.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
