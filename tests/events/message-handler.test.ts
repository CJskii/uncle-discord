import { Message } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageHandler } from '../../src/events/message-handler.js';
import { XdStatisticsService } from '../../src/services/xd-statistics-service.js';

describe('MessageHandler XD tracking', () => {
    let record = vi.fn().mockResolvedValue(undefined);
    let trigger = { process: vi.fn().mockResolvedValue(undefined) };

    beforeEach(() => vi.clearAllMocks());

    function message(overrides: Record<string, unknown> = {}): Message {
        return {
            system: false,
            content: 'XD i xd',
            webhookId: null,
            guildId: 'guild',
            channelId: 'channel',
            createdAt: new Date('2026-08-04T12:00:00Z'),
            author: { id: 'user', bot: false },
            inGuild: () => true,
            ...overrides,
        } as unknown as Message;
    }

    function handler(): MessageHandler {
        return new MessageHandler(
            trigger as never,
            { recordXdOccurrences: record } as unknown as XdStatisticsService
        );
    }

    it('records every occurrence and still processes triggers', async () => {
        await handler().process(message());
        expect(record).toHaveBeenCalledWith('guild', 'user', 'channel', 2, expect.any(Date));
        expect(trigger.process).toHaveBeenCalledOnce();
    });

    it.each([
        { author: { id: 'bot', bot: true } },
        { webhookId: 'webhook' },
        { guildId: null, inGuild: () => false },
    ])('ignores bots, webhooks and direct messages', async overrides => {
        await handler().process(message(overrides));
        expect(record).not.toHaveBeenCalled();
        expect(trigger.process).not.toHaveBeenCalled();
    });

    it('does nothing when there is no XD', async () => {
        await handler().process(message({ content: 'zwykła wiadomość' }));
        expect(record).not.toHaveBeenCalled();
        expect(trigger.process).toHaveBeenCalledOnce();
    });

    it('does not crash when persistence fails', async () => {
        record.mockRejectedValueOnce(new Error('database unavailable'));
        await expect(handler().process(message())).resolves.toBeUndefined();
        expect(trigger.process).toHaveBeenCalledOnce();
    });
});
