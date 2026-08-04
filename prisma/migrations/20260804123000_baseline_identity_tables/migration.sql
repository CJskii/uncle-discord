-- These models predate this repository's Prisma migration history. The
-- idempotent bridge keeps both existing databases and fresh deployments safe.
CREATE TABLE IF NOT EXISTS "discord_users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discord_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bf6_profiles" (
    "id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "bf6_username" TEXT NOT NULL,
    "bf6_display_name" TEXT,
    "bf6_nucleus_id" TEXT,
    "bf6_persona_id" TEXT,
    "bf6_platform" TEXT,
    "bf6_platform_id" TEXT,
    "bf6_status" TEXT,
    "bf6_visibility" TEXT,
    "bf6_created_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bf6_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bf6_profiles_discord_user_id_fkey"
        FOREIGN KEY ("discord_user_id") REFERENCES "discord_users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "bf6_profiles_discord_user_id_key" ON "bf6_profiles"("discord_user_id");
CREATE INDEX IF NOT EXISTS "idx_bf6_profiles_username" ON "bf6_profiles"("bf6_username");
