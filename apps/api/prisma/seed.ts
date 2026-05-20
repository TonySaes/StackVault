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

  console.log(`Seeded ${demoCategories.length} categories.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
