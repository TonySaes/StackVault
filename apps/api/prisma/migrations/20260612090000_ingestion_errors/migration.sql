-- CreateTable
CREATE TABLE "ingestion_errors" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_type" VARCHAR(120) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "source_status" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ingestion_errors_source_id" ON "ingestion_errors"("source_id");

-- CreateIndex
CREATE INDEX "idx_ingestion_errors_occurred_at" ON "ingestion_errors"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_ingestion_errors_error_type" ON "ingestion_errors"("error_type");

-- AddForeignKey
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
