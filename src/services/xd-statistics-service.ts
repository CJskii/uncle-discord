import { prisma } from '../db/prisma.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { ActivityMetric } from '../generated/prisma/enums.js';

export interface XdLeaderboardEntry {
    userId: string;
    count: number;
}

export class XdStatisticsService {
    constructor(private database: PrismaClient = prisma) {}

    public async recordXdOccurrences(
        guildId: string,
        userId: string,
        channelId: string,
        count: number,
        occurredAt: Date
    ): Promise<void> {
        if (count <= 0) return;
        let date = new Date(
            Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate())
        );
        await this.database.$transaction(async transaction => {
            await transaction.discordUser.upsert({
                where: { id: userId },
                create: { id: userId },
                update: {},
            });
            await transaction.discordGuild.upsert({
                where: { id: guildId },
                create: { id: guildId },
                update: {},
            });
            let guildMember = await transaction.discordGuildMember.upsert({
                where: { guildId_userId: { guildId, userId } },
                create: { guildId, userId },
                update: {},
            });
            await transaction.activityDailyAggregate.upsert({
                where: {
                    guildMemberId_channelDiscordId_metric_date: {
                        guildMemberId: guildMember.id,
                        channelDiscordId: channelId,
                        metric: ActivityMetric.XD,
                        date,
                    },
                },
                create: {
                    guildMemberId: guildMember.id,
                    channelDiscordId: channelId,
                    metric: ActivityMetric.XD,
                    date,
                    count,
                },
                update: { count: { increment: count } },
            });
        });
    }

    public async getUserLifetimeCount(guildId: string, userId: string): Promise<number> {
        let result = await this.database.activityDailyAggregate.aggregate({
            where: {
                guildMember: { guildId, userId },
                metric: ActivityMetric.XD,
            },
            _sum: { count: true },
        });
        return result._sum.count ?? 0;
    }

    public async getGuildLifetimeCount(guildId: string): Promise<number> {
        let result = await this.database.activityDailyAggregate.aggregate({
            where: {
                guildMember: { guildId },
                metric: ActivityMetric.XD,
            },
            _sum: { count: true },
        });
        return result._sum.count ?? 0;
    }

    public async getUserLifetimeRank(guildId: string, userId: string): Promise<number | null> {
        let entries = await this.getLeaderboard(guildId);
        let index = entries.findIndex(entry => entry.userId === userId);
        return index === -1 ? null : index + 1;
    }

    public async getLeaderboard(guildId: string, limit?: number): Promise<XdLeaderboardEntry[]> {
        let entries = await this.database.activityDailyAggregate.groupBy({
            by: ['guildMemberId'],
            where: {
                guildMember: { guildId },
                metric: ActivityMetric.XD,
            },
            _sum: { count: true },
            orderBy: { _sum: { count: 'desc' } },
            ...(limit === undefined ? {} : { take: limit }),
        });
        let members = await this.database.discordGuildMember.findMany({
            where: { id: { in: entries.map(entry => entry.guildMemberId) } },
            select: { id: true, userId: true },
        });
        let userIdsByMemberId = new Map(members.map(member => [member.id, member.userId]));
        return entries.flatMap(entry => {
            let userId = userIdsByMemberId.get(entry.guildMemberId);
            return userId === undefined ? [] : [{ userId, count: entry._sum.count ?? 0 }];
        });
    }

    public async getUserCountForPeriod(
        guildId: string,
        userId: string,
        start: Date,
        end: Date
    ): Promise<number> {
        let result = await this.database.activityDailyAggregate.aggregate({
            where: {
                guildMember: { guildId, userId },
                metric: ActivityMetric.XD,
                date: { gte: start, lt: end },
            },
            _sum: { count: true },
        });
        return result._sum.count ?? 0;
    }
}
