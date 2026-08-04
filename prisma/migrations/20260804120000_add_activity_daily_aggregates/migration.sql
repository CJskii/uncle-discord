CREATE TABLE "activity_daily_aggregates" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_daily_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_daily_aggregate_identity" ON "activity_daily_aggregates"("guild_id", "user_id", "channel_id", "kind", "date");
CREATE INDEX "idx_activity_guild_user" ON "activity_daily_aggregates"("guild_id", "user_id");
CREATE INDEX "idx_activity_guild_date" ON "activity_daily_aggregates"("guild_id", "date");
CREATE INDEX "idx_activity_guild_channel" ON "activity_daily_aggregates"("guild_id", "channel_id");
CREATE INDEX "idx_activity_user_date" ON "activity_daily_aggregates"("user_id", "date");
