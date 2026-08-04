import { ChatInputCommandInteraction, EmbedBuilder, Locale } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { XdCommand } from '../../../src/commands/chat/xd-command.js';
import { EventData } from '../../../src/models/internal-models.js';
import { XdStatisticsService } from '../../../src/services/xd-statistics-service.js';
import { InteractionUtils } from '../../../src/utils/index.js';

vi.mock('../../../src/utils/index.js', async importOriginal => {
    let original = await importOriginal<typeof import('../../../src/utils/index.js')>();
    return {
        ...original,
        InteractionUtils: {
            editReply: vi.fn().mockResolvedValue({}),
            send: vi.fn().mockResolvedValue({}),
        },
    };
});

describe('XdCommand', () => {
    let statistics = {
        getUserLifetimeCount: vi.fn(),
        getGuildLifetimeCount: vi.fn(),
        getUserLifetimeRank: vi.fn(),
    };
    let data = new EventData(Locale.Polish, Locale.Polish);

    beforeEach(() => {
        vi.clearAllMocks();
        statistics.getUserLifetimeCount.mockResolvedValue(142);
        statistics.getGuildLifetimeCount.mockResolvedValue(1337);
        statistics.getUserLifetimeRank.mockResolvedValue(3);
    });

    function interaction(
        options: {
            guildLocale?: Locale;
            selectedUserId?: string;
            resolveMember?: boolean;
        } = {}
    ): ChatInputCommandInteraction {
        let selectedUserId = options.selectedUserId;
        let invokingUser = {
            id: 'user',
            displayName: 'CJ Global',
            displayAvatarURL: () => 'https://example.com/user.png',
        };
        let selectedUser = selectedUserId
            ? {
                  id: selectedUserId,
                  displayName: 'Adam Global',
                  displayAvatarURL: () => 'https://example.com/other.png',
              }
            : null;
        let member =
            options.resolveMember === false
                ? null
                : {
                      id: selectedUserId ?? 'user',
                      displayName: selectedUserId ? 'Adam Serwerowy' : 'CJ Serwerowy',
                      displayAvatarURL: () => 'https://example.com/member.png',
                  };
        return {
            guildId: 'guild',
            guildLocale: options.guildLocale ?? Locale.Polish,
            guild: { members: { resolve: () => member } },
            user: invokingUser,
            inGuild: () => true,
            options: { getUser: () => selectedUser },
            deferred: true,
            replied: false,
        } as unknown as ChatInputCommandInteraction;
    }

    function sentEmbed(): EmbedBuilder {
        let payload = vi.mocked(InteractionUtils.editReply).mock.calls[0][1] as {
            embeds: EmbedBuilder[];
        };
        return payload.embeds[0];
    }

    it('edits the deferred reply with own Polish statistics and member identity', async () => {
        let intr = interaction();
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        let embed = sentEmbed();
        expect(embed.data.title).toBe('Statystyki XD — CJ Serwerowy');
        expect(embed.data.thumbnail?.url).toBe('https://example.com/member.png');
        expect(embed.data.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Twoja liczba XD', value: '142' }),
                expect.objectContaining({ name: 'Miejsce w rankingu', value: '#3' }),
                expect.objectContaining({
                    name: 'Wkład w upadek poziomu serwera',
                    value: '10,62%',
                }),
            ])
        );
        expect(vi.mocked(InteractionUtils.editReply).mock.calls[0][1]).toMatchObject({
            allowedMentions: { parse: [] },
        });
        expect(InteractionUtils.send).not.toHaveBeenCalled();
    });

    it('returns a Polish response for an English guild locale', async () => {
        let intr = interaction({ guildLocale: Locale.EnglishGB });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        let embed = sentEmbed();
        expect(embed.data.title).toBe('Statystyki XD — CJ Serwerowy');
        expect(embed.data.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Twoja liczba XD', value: '142' }),
                expect.objectContaining({ name: 'Miejsce w rankingu', value: '#3' }),
                expect.objectContaining({
                    name: 'Wkład w upadek poziomu serwera',
                    value: '10,62%',
                }),
            ])
        );
        expect(embed.data.fields).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Łączna liczba XD na serwerze' }),
            ])
        );
    });

    it('falls back to Polish for unsupported locales', async () => {
        let intr = interaction({ guildLocale: Locale.German });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        expect(sentEmbed().data.title).toBe('Statystyki XD — CJ Serwerowy');
    });

    it('handles a selected unranked user with no data', async () => {
        statistics.getUserLifetimeCount.mockResolvedValue(0);
        statistics.getGuildLifetimeCount.mockResolvedValue(0);
        statistics.getUserLifetimeRank.mockResolvedValue(null);
        let intr = interaction({ selectedUserId: 'other' });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        let embed = sentEmbed();
        expect(statistics.getUserLifetimeCount).toHaveBeenCalledWith('guild', 'other');
        expect(embed.data.title).toBe('Statystyki XD — Adam Serwerowy');
        expect(embed.data.description).toContain('Ten użytkownik nie wysłał');
        expect(embed.data.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Liczba XD użytkownika', value: '0' }),
                expect.objectContaining({ name: 'Miejsce w rankingu', value: 'Poza rankingiem' }),
                expect.objectContaining({ value: '0,00%' }),
            ])
        );
    });

    it('falls back to global user identity when member cache resolution fails', async () => {
        let intr = interaction({ selectedUserId: 'other', resolveMember: false });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        expect(sentEmbed().data.title).toBe('Statystyki XD — Adam Global');
        expect(sentEmbed().data.thumbnail?.url).toBe('https://example.com/other.png');
    });

    it('does not ping selected users or mentionable display names', async () => {
        let intr = interaction({ selectedUserId: 'other', resolveMember: false });
        Object.assign(intr.options.getUser('użytkownik'), { displayName: '@everyone @here' });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        let payload = vi.mocked(InteractionUtils.editReply).mock.calls[0][1];
        expect(payload).toMatchObject({ allowedMentions: { parse: [] } });
        expect(sentEmbed().data.title).toContain('@everyone @here');
        expect(InteractionUtils.send).not.toHaveBeenCalled();
    });

    it('returns a Polish database error without exposing the exception', async () => {
        statistics.getUserLifetimeCount.mockRejectedValue(new Error('secret database error'));
        let intr = interaction({ guildLocale: Locale.EnglishUS });
        await new XdCommand(statistics as unknown as XdStatisticsService).execute(intr, data);
        expect(InteractionUtils.editReply).toHaveBeenCalledWith(
            intr,
            'Nie udało się pobrać statystyk XD. Spróbuj ponownie później.'
        );
    });

    it('rejects use outside a server in Polish', async () => {
        let command = new XdCommand(statistics as unknown as XdStatisticsService);
        let intr = {
            guildLocale: null,
            inGuild: () => false,
            guildId: null,
        } as ChatInputCommandInteraction;
        await command.execute(intr, data);
        expect(InteractionUtils.editReply).toHaveBeenCalledWith(
            intr,
            'Tej komendy można używać tylko na serwerze.'
        );
    });
});
