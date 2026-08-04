import { Message } from 'discord.js';

import { EventHandler, TriggerHandler } from './index.js';
import { Logger, XdStatisticsService } from '../services/index.js';
import { countXdOccurrences } from '../utils/index.js';

export class MessageHandler implements EventHandler {
    constructor(
        private triggerHandler: TriggerHandler,
        private xdStatistics: XdStatisticsService
    ) {}

    public async process(msg: Message): Promise<void> {
        // Don't respond to system messages or self
        if (msg.system || msg.author.bot || msg.webhookId || !msg.inGuild()) {
            return;
        }

        let count = countXdOccurrences(msg.content);
        let tracking =
            count === 0
                ? Promise.resolve()
                : this.xdStatistics
                      .recordXdOccurrences(
                          msg.guildId,
                          msg.author.id,
                          msg.channelId,
                          count,
                          msg.createdAt
                      )
                      .catch(error =>
                          Logger.error(
                              `Failed to record XD occurrences guildId=${msg.guildId} channelId=${msg.channelId} userId=${msg.author.id} count=${count}`,
                              error
                          )
                      );

        await Promise.all([tracking, this.triggerHandler.process(msg)]);
    }
}
