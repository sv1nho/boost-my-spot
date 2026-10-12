-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "plan" TEXT NOT NULL DEFAULT 'lifetime',
    "country" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "sp_dc_sealed" BYTEA,
    "payment_provider" TEXT,
    "payment_id" TEXT,
    "spotify_account" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "expires_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "activated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key_hash" TEXT NOT NULL,
    "key_sealed" BYTEA NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'lifetime',
    "order_id" UUID,
    "upstream_status" TEXT,
    "checked_at" TIMESTAMPTZ,
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upgrade_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payment_id_key" ON "orders"("payment_id");

-- CreateIndex
CREATE INDEX "orders_status_next_attempt_at_idx" ON "orders"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "orders_email_idx" ON "orders"("email");

-- CreateIndex
CREATE INDEX "order_events_order_id_at_idx" ON "order_events"("order_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "upgrade_keys_key_hash_key" ON "upgrade_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "upgrade_keys_order_id_key" ON "upgrade_keys"("order_id");

-- CreateIndex
CREATE INDEX "upgrade_keys_plan_order_id_idx" ON "upgrade_keys"("plan", "order_id");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_keys" ADD CONSTRAINT "upgrade_keys_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guardrails the Prisma schema cannot express.

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_status_check" CHECK ("status" IN (
    'awaiting_payment','underpaid','expired','paid','upgrading',
    'active','renewing','needs_action','failed','refunded'
  )),
  ADD CONSTRAINT "orders_price_cents_check" CHECK ("price_cents" >= 0),
  ADD CONSTRAINT "orders_attempts_check" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "orders_reference_format_check"
    CHECK ("reference" ~ '^BMS-[0-9A-HJKMNP-TV-Z]{8}$'),
  ADD CONSTRAINT "orders_email_not_blank_check"
    CHECK (length(btrim("email")) > 0),
  ADD CONSTRAINT "orders_sp_dc_requires_active_status_check"
    CHECK (
      "sp_dc_sealed" IS NULL
      OR "status" IN ('awaiting_payment','paid','upgrading','renewing')
    );

ALTER TABLE "order_events"
  ADD CONSTRAINT "order_events_status_check" CHECK ("status" IN (
    'awaiting_payment','underpaid','expired','paid','upgrading',
    'active','renewing','needs_action','failed','refunded'
  )),
  ADD CONSTRAINT "order_events_actor_check"
    CHECK ("actor" IN ('system','customer','payment','admin'));

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
