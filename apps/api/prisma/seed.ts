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

  console.log(
    `Seeded ${demoCategories.length} categories and ${demoTechnologies.length} technologies.`,
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
