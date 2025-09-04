import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BaseCommand } from '../types/command';

export default class ExampleCommand extends BaseCommand {
  data = new SlashCommandBuilder()
    .setName('example')
    .setDescription('An example command that requires Manage Server permission');

  // Set Discord permission requirements for this command
  defaultPermissions = PermissionFlagsBits.ManageGuild; // Requires "Manage Server" permission

  async run(interaction: any) {
    await interaction.reply({
      content: 'This is an example command that requires Manage Server permission!',
      ephemeral: true,
    });
  }
}
