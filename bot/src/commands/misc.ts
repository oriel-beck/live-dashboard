import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
  GuildChannel,
  GuildMember,
  ChannelType,
} from "discord.js";
import { BaseCommand } from "../types/command";

export class MiscCommand extends BaseCommand {
  data = new SlashCommandBuilder()
    .setName("misc")
    .setDescription("Miscellaneous utility commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("permissions")
        .setDescription("Check user permissions in a channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to check permissions for")
            .setRequired(false)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice,
              ChannelType.GuildForum
            )
        )
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("The member to check permissions for")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("botpermissions")
        .setDescription("Check bot permissions in a channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to check bot permissions for")
            .setRequired(false)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice,
              ChannelType.GuildForum
            )
        )
    );

  async permissions(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in servers!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const targetChannel =
      (interaction.options.getChannel("channel") as GuildChannel) ||
      (interaction.channel as GuildChannel);
    const targetMember =
      (interaction.options.getMember("member") as GuildMember) ||
      (interaction.member as GuildMember);

    if (!targetChannel || !targetMember) {
      await interaction.reply({
        content: "Could not find the specified channel or member!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const permissions = targetChannel.permissionsFor(targetMember);

    if (!permissions) {
      await interaction.reply({
        content: "Could not check permissions for this member in this channel!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const importantPermissions = [
      { name: "View Channel", flag: PermissionsBitField.Flags.ViewChannel },
      { name: "Send Messages", flag: PermissionsBitField.Flags.SendMessages },
      {
        name: "Read Message History",
        flag: PermissionsBitField.Flags.ReadMessageHistory,
      },
      { name: "Add Reactions", flag: PermissionsBitField.Flags.AddReactions },
      { name: "Attach Files", flag: PermissionsBitField.Flags.AttachFiles },
      { name: "Embed Links", flag: PermissionsBitField.Flags.EmbedLinks },
      {
        name: "Manage Messages",
        flag: PermissionsBitField.Flags.ManageMessages,
      },
      {
        name: "Mention Everyone",
        flag: PermissionsBitField.Flags.MentionEveryone,
      },
      {
        name: "Use External Emojis",
        flag: PermissionsBitField.Flags.UseExternalEmojis,
      },
      { name: "Connect", flag: PermissionsBitField.Flags.Connect },
      { name: "Speak", flag: PermissionsBitField.Flags.Speak },
      { name: "Mute Members", flag: PermissionsBitField.Flags.MuteMembers },
      { name: "Deafen Members", flag: PermissionsBitField.Flags.DeafenMembers },
      { name: "Move Members", flag: PermissionsBitField.Flags.MoveMembers },
    ];

    const permissionsList = importantPermissions
      .map((perm) => {
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

  async botpermissions(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in servers!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const targetChannel =
      (interaction.options.getChannel("channel") as GuildChannel) ||
      (interaction.channel as GuildChannel);

    // Fetch bot member if not cached
    let botMember = interaction.guild.members.me;
    if (!botMember) {
      try {
        botMember = await interaction.guild.members.fetchMe();
      } catch (error) {
        await interaction.reply({
          content: "Could not fetch bot member information!",
          flags: ["Ephemeral"],
        });
        return;
      }
    }

    if (!targetChannel) {
      await interaction.reply({
        content: "Could not find the specified channel!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const permissions = targetChannel.permissionsFor(botMember);

    if (!permissions) {
      await interaction.reply({
        content: "Could not check bot permissions for this channel!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const botPermissions = [
      { name: "View Channel", flag: PermissionsBitField.Flags.ViewChannel },
      { name: "Send Messages", flag: PermissionsBitField.Flags.SendMessages },
      {
        name: "Read Message History",
        flag: PermissionsBitField.Flags.ReadMessageHistory,
      },
      { name: "Add Reactions", flag: PermissionsBitField.Flags.AddReactions },
      { name: "Attach Files", flag: PermissionsBitField.Flags.AttachFiles },
      { name: "Embed Links", flag: PermissionsBitField.Flags.EmbedLinks },
      {
        name: "Manage Messages",
        flag: PermissionsBitField.Flags.ManageMessages,
      },
      {
        name: "Use External Emojis",
        flag: PermissionsBitField.Flags.UseExternalEmojis,
      },
      {
        name: "Use Slash Commands",
        flag: PermissionsBitField.Flags.UseApplicationCommands,
      },
      { name: "Connect", flag: PermissionsBitField.Flags.Connect },
      { name: "Speak", flag: PermissionsBitField.Flags.Speak },
      { name: "Use Voice Activity", flag: PermissionsBitField.Flags.UseVAD },
    ];

    const permissionsList = botPermissions
      .map((perm) => {
        const hasPermission = permissions.has(perm.flag);
        const emoji = hasPermission ? "✅" : "❌";
        return `${emoji} ${perm.name}`;
      })
      .join("\n");

    const missingPermissions = botPermissions
      .filter((perm) => !permissions.has(perm.flag))
      .map((perm) => perm.name);

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
