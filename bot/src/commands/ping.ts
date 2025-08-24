import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { BaseCommand } from "../types/command";

export class PingCommand extends BaseCommand {
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  async run(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: "Pinging...",
      withResponse: true,
    });
    const latency = sent.interaction.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(
      `🏓 **Pong!**\n` +
        `📡 **Latency:** ${latency}ms\n` +
        `💗 **API Latency:** ${apiLatency}ms`
    );
  }
}
