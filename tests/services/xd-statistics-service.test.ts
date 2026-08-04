import { describe, expect, it, vi } from 'vitest';

import { XdStatisticsService } from '../../src/services/xd-statistics-service.js';

describe('XdStatisticsService', () => {
    function setup(): {
        service: XdStatisticsService;
        aggregate: ReturnType<typeof vi.fn>;
        groupBy: ReturnType<typeof vi.fn>;
        activityUpsert: ReturnType<typeof vi.fn>;
        guildUpsert: ReturnType<typeof vi.fn>;
        memberUpsert: ReturnType<typeof vi.fn>;
        userUpsert: ReturnType<typeof vi.fn>;
        findMembers: ReturnType<typeof vi.fn>;
    } {
        let aggregate = vi.fn();
        let groupBy = vi.fn();
        let activityUpsert = vi.fn().mockResolvedValue({});
        let guildUpsert = vi.fn().mockResolvedValue({ id: 'g' });
        let memberUpsert = vi.fn().mockResolvedValue({ id: 'member' });
        let userUpsert = vi.fn().mockResolvedValue({ id: 'u' });
        let findMembers = vi.fn();
        let database = {
            activityDailyAggregate: { aggregate, groupBy, upsert: activityUpsert },
            discordGuild: { upsert: guildUpsert },
            discordGuildMember: { upsert: memberUpsert, findMany: findMembers },
            discordUser: { upsert: userUpsert },
        };
        let transaction = vi.fn(async callback => await callback(database));
        Object.assign(database, { $transaction: transaction });
        return {
            service: new XdStatisticsService(database as never),
            aggregate,
            groupBy,
            activityUpsert,
            guildUpsert,
            memberUpsert,
            userUpsert,
            findMembers,
        };
    }

    it('uses an atomic increment in a daily aggregate', async () => {
        let { service, activityUpsert, guildUpsert, memberUpsert, userUpsert } = setup();
        await Promise.all([
            service.recordXdOccurrences('g', 'u', 'c', 2, new Date('2026-08-04T23:00:00Z')),
            service.recordXdOccurrences('g', 'u', 'c', 3, new Date('2026-08-04T23:01:00Z')),
        ]);
        expect(userUpsert).toHaveBeenCalledTimes(2);
        expect(guildUpsert).toHaveBeenCalledTimes(2);
        expect(memberUpsert).toHaveBeenCalledTimes(2);
        expect(memberUpsert).toHaveBeenCalledWith({
            where: { guildId_userId: { guildId: 'g', userId: 'u' } },
            create: { guildId: 'g', userId: 'u' },
            update: {},
        });
        expect(activityUpsert).toHaveBeenCalledTimes(2);
        expect(activityUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: { count: { increment: 2 } } })
        );
        expect(activityUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: { count: { increment: 3 } } })
        );
    });

    it('returns zero for empty totals', async () => {
        let { service, aggregate } = setup();
        aggregate.mockResolvedValue({ _sum: { count: null } });
        await expect(service.getUserLifetimeCount('g', 'u')).resolves.toBe(0);
        await expect(service.getGuildLifetimeCount('g')).resolves.toBe(0);
        await expect(
            service.getUserCountForPeriod('g', 'u', new Date(0), new Date())
        ).resolves.toBe(0);
    });

    it('returns totals, leaderboard and correct rank', async () => {
        let { service, aggregate, groupBy, findMembers } = setup();
        aggregate.mockResolvedValue({ _sum: { count: 42 } });
        groupBy.mockResolvedValue([
            { guildMemberId: 'member-first', _sum: { count: 100 } },
            { guildMemberId: 'member-user', _sum: { count: 42 } },
        ]);
        findMembers.mockResolvedValue([
            { id: 'member-first', userId: 'first' },
            { id: 'member-user', userId: 'user' },
        ]);
        await expect(service.getUserLifetimeCount('g', 'user')).resolves.toBe(42);
        await expect(service.getGuildLifetimeCount('g')).resolves.toBe(42);
        await expect(service.getLeaderboard('g', 10)).resolves.toEqual([
            { userId: 'first', count: 100 },
            { userId: 'user', count: 42 },
        ]);
        await expect(service.getUserLifetimeRank('g', 'user')).resolves.toBe(2);
        await expect(service.getUserLifetimeRank('g', 'missing')).resolves.toBeNull();
    });
});
