"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiscCommand = void 0;
const discord_js_1 = require("discord.js");
const command_1 = require("../types/command");
class MiscCommand extends command_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.data = new discord_js_1.SlashCommandBuilder()
            .setName("misc")
            .setDescription("Miscellaneous utility commands")
            .addSubcommand(subcommand => subcommand
            .setName("permissions")
            .setDescription("Check user permissions in a channel")
            .addChannelOption(option => option
            .setName("channel")
            .setDescription("The channel to check permissions for")
            .setRequired(false)
            .addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildVoice, discord_js_1.ChannelType.GuildForum))
            .addUserOption(option => option
            .setName("member")
            .setDescription("The member to check permissions for")
            .setRequired(false)))
            .addSubcommand(subcommand => subcommand
            .setName("botpermissions")
            .setDescription("Check bot permissions in a channel")
            .addChannelOption(option => option
            .setName("channel")
            .setDescription("The channel to check bot permissions for")
            .setRequired(false)
            .addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildVoice, discord_js_1.ChannelType.GuildForum)));
    }
    async permissions(interaction) {
        if (!interaction.guild) {
            await interaction.reply({
                content: "This command can only be used in servers!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
        const targetMember = interaction.options.getMember("member") || interaction.member;
        if (!targetChannel || !targetMember) {
            await interaction.reply({
                content: "Could not find the specified channel or member!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const permissions = targetChannel.permissionsFor(targetMember);
        if (!permissions) {
            await interaction.reply({
                content: "Could not check permissions for this member in this channel!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const importantPermissions = [
            { name: "View Channel", flag: discord_js_1.PermissionsBitField.Flags.ViewChannel },
            { name: "Send Messages", flag: discord_js_1.PermissionsBitField.Flags.SendMessages },
            { name: "Read Message History", flag: discord_js_1.PermissionsBitField.Flags.ReadMessageHistory },
            { name: "Add Reactions", flag: discord_js_1.PermissionsBitField.Flags.AddReactions },
            { name: "Attach Files", flag: discord_js_1.PermissionsBitField.Flags.AttachFiles },
            { name: "Embed Links", flag: discord_js_1.PermissionsBitField.Flags.EmbedLinks },
            { name: "Manage Messages", flag: discord_js_1.PermissionsBitField.Flags.ManageMessages },
            { name: "Mention Everyone", flag: discord_js_1.PermissionsBitField.Flags.MentionEveryone },
            { name: "Use External Emojis", flag: discord_js_1.PermissionsBitField.Flags.UseExternalEmojis },
            { name: "Connect", flag: discord_js_1.PermissionsBitField.Flags.Connect },
            { name: "Speak", flag: discord_js_1.PermissionsBitField.Flags.Speak },
            { name: "Mute Members", flag: discord_js_1.PermissionsBitField.Flags.MuteMembers },
            { name: "Deafen Members", flag: discord_js_1.PermissionsBitField.Flags.DeafenMembers },
            { name: "Move Members", flag: discord_js_1.PermissionsBitField.Flags.MoveMembers },
        ];
        const permissionsList = importantPermissions
            .map(perm => {
            const hasPermission = permissions.has(perm.flag);
            const emoji = hasPermission ? "✅" : "❌";
            return `${emoji} ${perm.name}`;
        })
            .join("\n");
        const embed = {
            title: "🔒 User Permissions",
            description: `Permissions for **${targetMember.displayName}** in ${targetChannel}:`,
            fields: [
                {
                    name: "Permissions",
                    value: permissionsList,
                    inline: false,
                },
            ],
            color: 0x3498db,
            footer: {
                text: `Requested by ${interaction.user.tag}`,
            },
            timestamp: new Date().toISOString(),
        };
        await interaction.reply({
            embeds: [embed],
        });
    }
    async botpermissions(interaction) {
        if (!interaction.guild) {
            await interaction.reply({
                content: "This command can only be used in servers!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
        const botMember = interaction.guild.members.me;
        if (!targetChannel || !botMember) {
            await interaction.reply({
                content: "Could not find the specified channel or bot member!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const permissions = targetChannel.permissionsFor(botMember);
        if (!permissions) {
            await interaction.reply({
                content: "Could not check bot permissions for this channel!",
                flags: ['Ephemeral'],
            });
            return;
        }
        const botPermissions = [
            { name: "View Channel", flag: discord_js_1.PermissionsBitField.Flags.ViewChannel },
            { name: "Send Messages", flag: discord_js_1.PermissionsBitField.Flags.SendMessages },
            { name: "Read Message History", flag: discord_js_1.PermissionsBitField.Flags.ReadMessageHistory },
            { name: "Add Reactions", flag: discord_js_1.PermissionsBitField.Flags.AddReactions },
            { name: "Attach Files", flag: discord_js_1.PermissionsBitField.Flags.AttachFiles },
            { name: "Embed Links", flag: discord_js_1.PermissionsBitField.Flags.EmbedLinks },
            { name: "Manage Messages", flag: discord_js_1.PermissionsBitField.Flags.ManageMessages },
            { name: "Use External Emojis", flag: discord_js_1.PermissionsBitField.Flags.UseExternalEmojis },
            { name: "Use Slash Commands", flag: discord_js_1.PermissionsBitField.Flags.UseApplicationCommands },
            { name: "Connect", flag: discord_js_1.PermissionsBitField.Flags.Connect },
            { name: "Speak", flag: discord_js_1.PermissionsBitField.Flags.Speak },
            { name: "Use Voice Activity", flag: discord_js_1.PermissionsBitField.Flags.UseVAD },
        ];
        const permissionsList = botPermissions
            .map(perm => {
            const hasPermission = permissions.has(perm.flag);
            const emoji = hasPermission ? "✅" : "❌";
            return `${emoji} ${perm.name}`;
        })
            .join("\n");
        const missingPermissions = botPermissions
            .filter(perm => !permissions.has(perm.flag))
            .map(perm => perm.name);
        const embed = {
            title: "🤖 Bot Permissions",
            description: `Permissions for **${botMember.displayName}** in ${targetChannel}:`,
            fields: [
                {
                    name: "Permissions",
                    value: permissionsList,
                    inline: false,
                },
            ],
            color: missingPermissions.length > 0 ? 0xe74c3c : 0x2ecc71,
            footer: {
                text: `Requested by ${interaction.user.tag}`,
            },
            timestamp: new Date().toISOString(),
        };
        if (missingPermissions.length > 0) {
            embed.fields.push({
                name: "⚠️ Missing Permissions",
                value: missingPermissions.join(", "),
                inline: false,
            });
        }
        await interaction.reply({
            embeds: [embed],
        });
    }
}
exports.MiscCommand = MiscCommand;
//# sourceMappingURL=misc.js.map