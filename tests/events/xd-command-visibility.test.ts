import { ChatInputCommandInteraction, Locale } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Command, CommandDeferType } from '../../src/commands/index.js';
import { CommandHandler } from '../../src/events/command-handler.js';
import { EventData } from '../../src/models/internal-models.js';
import { EventDataService } from '../../src/services/event-data-service.js';
import { CommandUtils, InteractionUtils } from '../../src/utils/index.js';

vi.mock('../../src/utils/index.js', () => ({
    CommandUtils: {
        findCommand: vi.fn(),
        runChecks: vi.fn().mockResolvedValue(true),
    },
    InteractionUtils: {
        deferReply: vi.fn(),
        send: vi.fn(),
    },
}));

describe('XD command visibility through CommandHandler', () => {
    beforeEach(() => vi.clearAllMocks());

    it('publicly defers before executing the command', async () => {
        let execute = vi.fn().mockResolvedValue(undefined);
        let command: Command = {
            names: ['xd'],
            deferType: CommandDeferType.PUBLIC,
            requireClientPerms: [],
            execute,
        };
        vi.mocked(CommandUtils.findCommand).mockReturnValue(command);
        vi.mocked(InteractionUtils.deferReply).mockImplementation(async intr => {
            Object.defineProperty(intr, 'deferred', { value: true, configurable: true });
            return undefined;
        });
        let eventData = new EventData(Locale.Polish, Locale.Polish);
        let eventDataService = {
            create: vi.fn().mockResolvedValue(eventData),
        } as unknown as EventDataService;
        let intr = Object.create(ChatInputCommandInteraction.prototype);
        Object.defineProperties(intr, {
            commandName: { value: 'xd' },
            client: { value: { user: { id: 'bot' } } },
            user: { value: { id: 'user', bot: false } },
            options: {
                value: {
                    getSubcommandGroup: () => null,
                    getSubcommand: () => null,
                },
            },
            channel: { value: null },
            guild: { value: { preferredLocale: Locale.Polish } },
            deferred: { value: false, configurable: true },
        });

        await new CommandHandler([command], eventDataService).process(intr);

        expect(InteractionUtils.deferReply).toHaveBeenCalledWith(intr, false);
        expect(execute).toHaveBeenCalledWith(intr, eventData);
        expect(InteractionUtils.send).not.toHaveBeenCalled();
    });
});
