-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "max_redemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN "discount_cents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "promo_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- Guardrails the Prisma schema cannot express.

ALTER TABLE "promo_codes"
  ADD CONSTRAINT "promo_codes_code_not_blank_check"
    CHECK (length(btrim("code")) > 0),
  ADD CONSTRAINT "promo_codes_redemptions_check"
    CHECK ("redemptions" >= 0),
  ADD CONSTRAINT "promo_codes_max_redemptions_check"
    CHECK ("max_redemptions" IS NULL OR "max_redemptions" >= 1),
  ADD CONSTRAINT "promo_codes_value_check"
    CHECK (
      ("kind" = 'percent' AND "value" BETWEEN 1 AND 100)
      OR ("kind" = 'amount' AND "value" >= 1)
    );

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_discount_cents_check" CHECK ("discount_cents" >= 0);
