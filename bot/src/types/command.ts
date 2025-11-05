import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { logger } from "@discord-bot/services";

// ===== BASE COMMAND CLASS =====
// Abstract base class that all commands must extend

export abstract class BaseCommand {
  abstract data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

  // Default Discord permission requirements for this command and all subcommands
  // These will be sent to the backend and used to set default_member_permissions
  defaultPermissions: bigint = 0n; // Discord permission bits (e.g., PermissionFlagsBits.ManageGuild)
  cooldown: number = 0;

  // Main execution method that routes to appropriate handler
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(false);

    if (subcommand) {
      // Check if subcommand method exists
      const methodName = subcommand.replace(/-/g, "_"); // Convert kebab-case to snake_case
      const method = (this as Record<string, unknown>)[methodName];

      if (typeof method === "function") {
        await method.call(this, interaction);
      } else {
        logger.error(
          `[BaseCommand] Subcommand method '${methodName}' not found for command '${this.name}'`
        );
        await interaction.reply({
          content: "This subcommand is not implemented yet.",
          flags: ["Ephemeral"],
        });
      }
    } else {
      // No subcommand, call run method
      if (typeof (this as { run?: unknown }).run === "function") {
        await (
          this as unknown as {
            run: (interaction: ChatInputCommandInteraction) => Promise<void>;
          }
        ).run.call(this, interaction);
      } else {
        logger.error(
          `[BaseCommand] Run method not found for command '${this.name}'`
        );
        await interaction.reply({
          content: "This command is not implemented yet.",
          flags: ["Ephemeral"],
        });
      }
    }
  }

  // Get command name from SlashCommandBuilder
  get name(): string {
    return this.data.name;
  }

  // Get command description from SlashCommandBuilder
  get description(): string {
    return this.data.description;
  }
}

// Removed unused re-exports: CommandExecutionContext, CommandInfo, PermissionCheckResult
