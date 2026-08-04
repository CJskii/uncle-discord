import { ChatInputCommandInteraction, EmbedBuilder, Locale, PermissionsString } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { EventData } from '../../models/internal-models.js';
import { Lang, Logger, XdStatisticsService } from '../../services/index.js';
import { formatXdNumber, formatXdPercentage, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class XdCommand implements Command {
    public names = [Lang.getRef('chatCommands.xd', Locale.Polish)];
    public cooldown = new RateLimiter(1, 5000);
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];

    constructor(private statistics: XdStatisticsService = new XdStatisticsService()) {}

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let locale = Locale.Polish;
        if (!intr.inGuild() || !intr.guildId) {
            await InteractionUtils.editReply(intr, Lang.getRef('xd.guildOnly', locale));
            return;
        }

        try {
            let user =
                intr.options.getUser(Lang.getRef('arguments.xdUser', Locale.Polish)) ?? intr.user;
            let member = intr.guild.members.resolve(user.id);
            let displayName = member?.displayName ?? user.displayName;
            let isSelf = user.id === intr.user.id;
            let [userCount, guildCount, rank] = await Promise.all([
                this.statistics.getUserLifetimeCount(intr.guildId, user.id),
                this.statistics.getGuildLifetimeCount(intr.guildId),
                this.statistics.getUserLifetimeRank(intr.guildId, user.id),
            ]);
            let contribution = guildCount === 0 ? 0 : userCount / guildCount;
            let embed: EmbedBuilder = Lang.getEmbed(
                isSelf ? 'displayEmbeds.xdStatisticsOwn' : 'displayEmbeds.xdStatisticsOther',
                locale,
                {
                    DISPLAY_NAME: displayName,
                    USER_COUNT: formatXdNumber(userCount, locale),
                    RANK:
                        rank === null
                            ? Lang.getRef('xd.unranked', locale)
                            : `#${formatXdNumber(rank, locale)}`,
                    CONTRIBUTION: formatXdPercentage(contribution, locale),
                    EMPTY_STATE:
                        userCount === 0
                            ? Lang.getRef(isSelf ? 'xd.noDataOwn' : 'xd.noDataOther', locale)
                            : '\u200b',
                }
            ).setThumbnail(member?.displayAvatarURL() ?? user.displayAvatarURL());
            await InteractionUtils.editReply(intr, {
                embeds: [embed],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            Logger.error(
                `Failed to retrieve XD statistics guildId=${intr.guildId} userId=${intr.user.id}`,
                error
            );
            await InteractionUtils.editReply(intr, Lang.getRef('xd.unexpectedError', locale));
        }
    }
}
