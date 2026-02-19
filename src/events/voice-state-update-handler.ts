import {
    ChannelType,
    Guild,
    GuildBasedChannel,
    PermissionFlagsBits,
    VoiceChannel,
    VoiceState,
} from 'discord.js';

import { Config } from '../constants/config.js';
import { Logger } from '../services/index.js';



export class VoiceStateUpdateHandler {
    private readonly CREATE_CHANNEL_ID: string;
    private readonly TEMP_CATEGORY_ID: string;

    constructor() {
        this.CREATE_CHANNEL_ID = Config.CREATE_CHANNEL_ID;
        this.TEMP_CATEGORY_ID = Config.TEMP_CATEGORY_ID;
    }

    // Debounce to prevent duplicate channels from rapid voice updates
    private readonly creatingForUser = new Set<string>();

    // Per-channel delete timers (so we delete only after being empty for 1s)
    private readonly deleteTimers = new Map<string, NodeJS.Timeout>();

    // Debounced sweep timer
    private sweepTimer: NodeJS.Timeout | null = null;

    public async process(oldState: VoiceState, newState: VoiceState): Promise<void> {
        Logger.info(
            `[voice-event] fired from=${oldState.channelId ?? 'none'} to=${newState.channelId ?? 'none'} userId=${newState.id}`
        );

        // Cleanup when we know what channel the user left
        if (oldState.channelId) {
            this.scheduleDeleteIfEmpty(oldState.channelId, oldState.guild);
        }

        // Sweep fallback (useful even if state is partial; debounced)
        this.scheduleSweep(newState.guild);

        // Join-to-create
        if (oldState.channelId === newState.channelId) return;
        if (newState.channelId !== this.CREATE_CHANNEL_ID) return;

        const userId = newState.id;
        const guild = newState.guild;
        const member = newState.member;

        if (!member) {
            Logger.error(
                `[voice] member is missing for userId=${userId}. Ensure GuildMembers intent is enabled.`
            );
            return;
        }

        await this.withUserDebounce(userId, async () => {
            const safeName = this.sanitizeChannelName(member.displayName);
            const channelName = `🔊 ${safeName || 'temp'}`.slice(0, 90);

            const created = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: this.TEMP_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.Stream,
                            PermissionFlagsBits.UseVAD,
                            PermissionFlagsBits.PrioritySpeaker,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers,
                            PermissionFlagsBits.DeafenMembers,
                            PermissionFlagsBits.ManageChannels,
                        ],
                    },
                ],
            });

            if (created.type !== ChannelType.GuildVoice) {
                Logger.error(
                    `[voice] expected GuildVoice channel but got type=${created.type} channelId=${created.id}`
                );
                return;
            }

            const newVoiceChannel = created;

            await member.voice.setChannel(newVoiceChannel);

            Logger.info(
                `[voice] created+move userId=${member.id} guildId=${guild.id} channelId=${newVoiceChannel.id}`
            );
        }).catch(error => {
            Logger.error('[voice] error creating or moving to temp voice channel:', error);
        });
    }

    private sanitizeChannelName(name: string): string {
        // Keep letters/numbers/space/_- and trim
        return name.replace(/[^\p{L}\p{N}\s\-_]/gu, '').trim();
    }

    private async withUserDebounce(userId: string, fn: () => Promise<void>): Promise<void> {
        if (this.creatingForUser.has(userId)) return;
        this.creatingForUser.add(userId);
        try {
            await fn();
        } finally {
            this.creatingForUser.delete(userId);
        }
    }

    /**
     * Schedule a delete check after 1s. If still empty (confirmed), delete it.
     */
    private scheduleDeleteIfEmpty(channelId: string, guild: Guild): void {
        // Never delete the create channel
        if (channelId === this.CREATE_CHANNEL_ID) return;

        const existing = this.deleteTimers.get(channelId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout((): void => {
            this.deleteTimers.delete(channelId);
            void this.deleteIfConfirmedEmptyForOneSecond(channelId, guild);
        }, 1000);

        this.deleteTimers.set(channelId, timer);
    }

    private async deleteIfConfirmedEmptyForOneSecond(
        channelId: string,
        guild: Guild
    ): Promise<void> {
        try {
            const c1 = await guild.channels.fetch(channelId).catch(() => null);
            if (!this.isTempVoiceChannel(c1)) return;

            Logger.info(`[voice-cleanup] check1 channelId=${c1.id} members=${c1.members.size}`);
            if (c1.members.size > 0) return;

            const stillEmpty = await this.confirmEmptyForOneSecond(c1, guild);
            if (!stillEmpty) return;

            await c1.delete('Temporary voice channel empty for 1s');
            Logger.info(`[voice] deleted empty temp channel channelId=${c1.id}`);
        } catch (error) {
            Logger.error(`[voice] failed to delete temp channel channelId=${channelId}:`, error);
        }
    }

    /**
     * Confirm the channel remains empty for 1s by refetching and checking again.
     */
    private async confirmEmptyForOneSecond(channel: VoiceChannel, guild: Guild): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const c2 = await guild.channels.fetch(channel.id).catch(() => null);
        if (!this.isTempVoiceChannel(c2)) return false;

        Logger.info(`[voice-cleanup] check2 channelId=${c2.id} members=${c2.members.size}`);
        return c2.members.size === 0;
    }

    /**
     * A "temp voice channel" is:
     * - a GuildVoice channel
     * - under TEMP_CATEGORY_ID
     * - not the CREATE_CHANNEL_ID
     */
    private isTempVoiceChannel(channel: GuildBasedChannel | null): channel is VoiceChannel {
        if (!channel) return false;
        if (channel.id === this.CREATE_CHANNEL_ID) return false;
        if (channel.type !== ChannelType.GuildVoice) return false;
        if (channel.parentId !== this.TEMP_CATEGORY_ID) return false;
        return true;
    }

    /**
     * Debounced sweep: schedules delete checks for all temp voice channels in the category.
     */
    private scheduleSweep(guild: Guild): void {
        if (this.sweepTimer) return;

        this.sweepTimer = setTimeout((): void => {
            this.sweepTimer = null;
            void this.sweepTempCategory(guild);
        }, 500);
    }

    private async sweepTempCategory(guild: Guild): Promise<void> {
        try {
            const channels = await guild.channels.fetch();

            for (const ch of channels.values()) {
                // Only schedule checks for temp voice channels
                if (!this.isTempVoiceChannel(ch as GuildBasedChannel | null)) continue;
                this.scheduleDeleteIfEmpty(ch.id, guild);
            }
        } catch (error) {
            Logger.error('[voice] sweep failed:', error);
        }
    }
}
