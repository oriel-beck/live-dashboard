import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { BaseCommand } from "../types/command";
import { CATEGORIES } from "@discord-bot/shared-types";

export class PingCommand extends BaseCommand {
  category = CATEGORIES.GENERAL;
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  // Set a 5-second cooldown for this command
  cooldown = 5;

  async run(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: "Pinging...",
      withResponse: true,
    });
    const latency =
      sent.interaction.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(
      `🏓 **Pong!**\n` +
        `📡 **Latency:** ${latency}ms\n` +
        `💗 **API Latency:** ${apiLatency}ms`
    );
  }
}
