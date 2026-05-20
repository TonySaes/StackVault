-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_ingestion_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "signal_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "source_url" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "short_summary" TEXT,
    "lifecycle_status" TEXT NOT NULL DEFAULT 'active',
    "link_status" TEXT NOT NULL DEFAULT 'unknown',
    "last_link_check_at" TIMESTAMPTZ(6),
    "retention_eligible_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_technologies" (
    "resource_id" UUID NOT NULL,
    "technology_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_technologies_pkey" PRIMARY KEY ("resource_id","technology_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_url_key" ON "sources"("url");

-- CreateIndex
CREATE INDEX "idx_sources_status" ON "sources"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_slug_key" ON "technologies"("slug");

-- CreateIndex
CREATE INDEX "idx_technologies_status" ON "technologies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "resources_canonical_url_key" ON "resources"("canonical_url");

-- CreateIndex
CREATE INDEX "idx_resources_source_id" ON "resources"("source_id");

-- CreateIndex
CREATE INDEX "idx_resources_category_id" ON "resources"("category_id");

-- CreateIndex
CREATE INDEX "idx_resources_published_at" ON "resources"("published_at");

-- CreateIndex
CREATE INDEX "idx_resources_detected_at" ON "resources"("detected_at");

-- CreateIndex
CREATE INDEX "idx_resources_link_status" ON "resources"("link_status");

-- CreateIndex
CREATE INDEX "idx_resources_lifecycle_status" ON "resources"("lifecycle_status");

-- CreateIndex
CREATE INDEX "idx_resource_technologies_technology_id" ON "resource_technologies"("technology_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_technologies" ADD CONSTRAINT "resource_technologies_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_technologies" ADD CONSTRAINT "resource_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
