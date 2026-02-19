import { CommandInteraction } from 'discord.js';

import { prisma } from '../../db/prisma.js';
import { HttpService } from '../../services/http-service.js';
import { Logger } from '../../services/logger.js';
import { Command, CommandDeferType } from '../index.js';

type GameToolsResponse = {
    results?: Array<{
        displayName: string;
        username: string;
        status: string;
        visibility: string;
        nucleusId: string;
        createdAt: string;
        personaId: string;
        platform: string;
        platformId: string;
    }>;
};

export class RegisterBF6Command implements Command {
    public names = ['register-bf6'];

    public deferType = CommandDeferType.HIDDEN;

    public requireClientPerms = [];

    public async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const username =
            // @ts-expect-error depending on how your handler types options
            (interaction.options?.getString?.('username') as string | null)?.trim() ?? '';

        if (!username) {
            await interaction.editReply('Usage: /register-bf6 username:<your bf6 name>');
            return;
        }

        try {
            const url = `https://api.gametools.network/bf6/player/?name=${encodeURIComponent(
                username
            )}`;

            const res = await new HttpService().get(url, '');
            const data = (await res.json()) as GameToolsResponse;

            const player = data.results?.[0];
            if (!player) {
                await interaction.editReply(`No BF6 player found for "${username}".`);
                return;
            }

            const discordUserId = interaction.user.id;

            await prisma.discordUser.upsert({
                where: { id: discordUserId },
                create: { id: discordUserId },
                update: {},
            });

            await prisma.bf6Profile.upsert({
                where: { discordUserId },
                create: {
                    discordUserId,
                    bf6Username: player.username,
                    displayName: player.displayName,
                    nucleusId: player.nucleusId,
                    personaId: player.personaId,
                    platform: player.platform,
                    platformId: player.platformId,
                    status: player.status,
                    visibility: player.visibility,
                    bf6CreatedAt: new Date(player.createdAt),
                    lastSyncedAt: new Date(),
                },
                update: {
                    bf6Username: player.username,
                    displayName: player.displayName,
                    nucleusId: player.nucleusId,
                    personaId: player.personaId,
                    platform: player.platform,
                    platformId: player.platformId,
                    status: player.status,
                    visibility: player.visibility,
                    bf6CreatedAt: new Date(player.createdAt),
                    lastSyncedAt: new Date(),
                },
            });

            Logger.info(`[bf6] linked discordUserId=${discordUserId} bf6=${player.username}`);

            await interaction.editReply(
                `✅ Linked BF6 user **${player.displayName}** (${player.platform}/${player.platformId}).`
            );
        } catch (error) {
            Logger.error('[bf6] register failed:', error);
            await interaction.editReply('Failed to register BF6 user. Please try again later.');
        }
    }
}
