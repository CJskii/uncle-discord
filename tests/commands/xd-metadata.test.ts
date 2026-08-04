import { ApplicationCommandOptionType, Locale } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { Args } from '../../src/commands/args.js';
import { XdCommand } from '../../src/commands/chat/xd-command.js';
import { CommandDeferType } from '../../src/commands/command.js';
import { ChatCommandMetadata } from '../../src/commands/metadata.js';
import { XdStatisticsService } from '../../src/services/xd-statistics-service.js';

describe('XD command metadata', () => {
    it('includes the repository-standard command properties', () => {
        let command = new XdCommand({} as XdStatisticsService);
        expect(command.names).toEqual(['xd']);
        expect(command.deferType).toBe(CommandDeferType.PUBLIC);
        expect(command.requireClientPerms).toEqual([]);
        expect(command.cooldown).toMatchObject({ amount: 1, interval: 5000 });
    });

    it('uses Polish defaults and English command localisations', () => {
        let metadata = ChatCommandMetadata.XD;
        expect(metadata).toMatchObject({
            name: 'xd',
            description: 'Sprawdź statystyki używania XD.',
            dm_permission: false,
            default_member_permissions: undefined,
        });
        expect(metadata.name_localizations).toMatchObject({
            [Locale.EnglishUS]: 'xd',
            [Locale.EnglishGB]: 'xd',
        });
        expect(metadata.description_localizations).toMatchObject({
            [Locale.EnglishUS]: 'View XD usage statistics.',
            [Locale.EnglishGB]: 'View XD usage statistics.',
        });
    });

    it('serialises an optional user option with English localisations', () => {
        expect(Args.XD_USER).toMatchObject({
            type: ApplicationCommandOptionType.User,
            name: 'użytkownik',
            description: 'Użytkownik, którego statystyki chcesz sprawdzić.',
            name_localizations: { [Locale.EnglishUS]: 'user', [Locale.EnglishGB]: 'user' },
            description_localizations: {
                [Locale.EnglishUS]: 'The user whose statistics you want to view.',
                [Locale.EnglishGB]: 'The user whose statistics you want to view.',
            },
        });
        expect(ChatCommandMetadata.XD.options).toEqual([{ ...Args.XD_USER, required: false }]);
        expect(() => JSON.stringify(ChatCommandMetadata.XD)).not.toThrow();
    });
});
