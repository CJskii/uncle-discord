CREATE TYPE "ActivityMetric" AS ENUM ('XD');

CREATE TABLE "discord_guilds" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discord_guilds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discord_guild_members" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discord_guild_members_pkey" PRIMARY KEY ("id")
);

INSERT INTO "discord_users" ("id", "created_at", "updated_at")
SELECT DISTINCT "user_id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "activity_daily_aggregates"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "discord_guilds" ("id", "created_at", "updated_at")
SELECT DISTINCT "guild_id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "activity_daily_aggregates";

INSERT INTO "discord_guild_members" ("id", "guild_id", "user_id", "created_at", "updated_at")
SELECT DISTINCT
    'legacy_' || "guild_id" || ':' || "user_id",
    "guild_id",
    "user_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "activity_daily_aggregates";

CREATE UNIQUE INDEX "discord_guild_members_guild_user_key" ON "discord_guild_members"("guild_id", "user_id");
CREATE INDEX "idx_discord_guild_members_user" ON "discord_guild_members"("user_id");

ALTER TABLE "discord_guild_members"
ADD CONSTRAINT "discord_guild_members_guild_id_fkey"
FOREIGN KEY ("guild_id") REFERENCES "discord_guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discord_guild_members"
ADD CONSTRAINT "discord_guild_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "discord_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_daily_aggregates" ADD COLUMN "guild_member_id" TEXT;

UPDATE "activity_daily_aggregates" AS activity
SET "guild_member_id" = member."id"
FROM "discord_guild_members" AS member
WHERE member."guild_id" = activity."guild_id"
  AND member."user_id" = activity."user_id";

ALTER TABLE "activity_daily_aggregates" ALTER COLUMN "guild_member_id" SET NOT NULL;
ALTER TABLE "activity_daily_aggregates" ALTER COLUMN "kind" TYPE "ActivityMetric" USING "kind"::"ActivityMetric";

DROP INDEX "activity_daily_aggregate_identity";
DROP INDEX "idx_activity_guild_user";
DROP INDEX "idx_activity_guild_date";
DROP INDEX "idx_activity_guild_channel";
DROP INDEX "idx_activity_user_date";

ALTER TABLE "activity_daily_aggregates" DROP COLUMN "guild_id";
ALTER TABLE "activity_daily_aggregates" DROP COLUMN "user_id";

CREATE UNIQUE INDEX "activity_daily_aggregate_identity" ON "activity_daily_aggregates"("guild_member_id", "channel_id", "kind", "date");
CREATE INDEX "idx_activity_member_metric_date" ON "activity_daily_aggregates"("guild_member_id", "kind", "date");
CREATE INDEX "idx_activity_metric_date" ON "activity_daily_aggregates"("kind", "date");
CREATE INDEX "idx_activity_channel_metric_date" ON "activity_daily_aggregates"("channel_id", "kind", "date");

ALTER TABLE "activity_daily_aggregates"
ADD CONSTRAINT "activity_daily_aggregates_guild_member_id_fkey"
FOREIGN KEY ("guild_member_id") REFERENCES "discord_guild_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
