-- Single responsibility: Additive database migration for providers table and chat/message provider columns.

CREATE TABLE IF NOT EXISTS "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" varchar(32) NOT NULL,
  "label" varchar(64) NOT NULL,
  "base_url" text NOT NULL,
  "api_key_enc" text,
  "default_model" varchar(128),
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "chats"
  ADD COLUMN IF NOT EXISTS "provider_id" uuid
  REFERENCES "providers"("id") ON DELETE SET NULL;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "provider_id" uuid
  REFERENCES "providers"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "model" varchar(128),
  ADD COLUMN IF NOT EXISTS "meta" jsonb;
