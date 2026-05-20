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

const firstDemoResource = {
  title: 'React Compiler release candidate',
  sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
  canonicalUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
  publishedAt: new Date('2025-04-21T00:00:00.000Z'),
  shortSummary:
    'React Compiler reaches release candidate status and prepares automatic optimizations for React applications.',
  sourceUrlKey: 'https://react.dev/blog',
  categorySlug: 'release',
  technologySlug: 'react',
};

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

  const source = await prisma.source.findUniqueOrThrow({
    where: {
      url: firstDemoResource.sourceUrlKey,
    },
  });
  const category = await prisma.category.findUniqueOrThrow({
    where: {
      slug: firstDemoResource.categorySlug,
    },
  });
  const technology = await prisma.technology.findUniqueOrThrow({
    where: {
      slug: firstDemoResource.technologySlug,
    },
  });

  const resource = await prisma.resource.upsert({
    where: {
      canonicalUrl: firstDemoResource.canonicalUrl,
    },
    update: {
      sourceId: source.id,
      categoryId: category.id,
      title: firstDemoResource.title,
      sourceUrl: firstDemoResource.sourceUrl,
      publishedAt: firstDemoResource.publishedAt,
      shortSummary: firstDemoResource.shortSummary,
      lifecycleStatus: 'active',
      linkStatus: 'unknown',
    },
    create: {
      sourceId: source.id,
      categoryId: category.id,
      title: firstDemoResource.title,
      sourceUrl: firstDemoResource.sourceUrl,
      canonicalUrl: firstDemoResource.canonicalUrl,
      publishedAt: firstDemoResource.publishedAt,
      shortSummary: firstDemoResource.shortSummary,
      lifecycleStatus: 'active',
      linkStatus: 'unknown',
    },
  });

  await prisma.resourceTechnology.upsert({
    where: {
      resourceId_technologyId: {
        resourceId: resource.id,
        technologyId: technology.id,
      },
    },
    update: {},
    create: {
      resourceId: resource.id,
      technologyId: technology.id,
    },
  });

  console.log(
    `Seeded ${demoCategories.length} categories, ${demoTechnologies.length} technologies, ${demoSources.length} sources and 1 resource.`,
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
