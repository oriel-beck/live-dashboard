"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingCommand = void 0;
const discord_js_1 = require("discord.js");
const command_1 = require("../types/command");
class PingCommand extends command_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.data = new discord_js_1.SlashCommandBuilder()
            .setName("ping")
            .setDescription("Replies with Pong!");
    }
    async run(interaction) {
        const sent = await interaction.reply({
            content: "Pinging...",
            withResponse: true,
        });
        const latency = sent.interaction.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        await interaction.editReply(`🏓 **Pong!**\n` +
            `📡 **Latency:** ${latency}ms\n` +
            `💗 **API Latency:** ${apiLatency}ms`);
    }
}
exports.PingCommand = PingCommand;
//# sourceMappingURL=ping.js.map