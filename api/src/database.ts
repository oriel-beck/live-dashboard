import { PrismaClient, DefaultCommand, CommandCategory } from '@prisma/client';

const prisma = new PrismaClient();

export class DefaultCommandService {
  // Register or update a default command from deployment
  static async upsertDefaultCommand(command: {
    discordId?: bigint | null; // Only for main commands
    name: string;
    description: string;
    cooldown: number;
    permissions: bigint;
    enabled: boolean;
    parentId?: number | null;
  }): Promise<DefaultCommand> {
    if (command.discordId) {
      // Main command - use discordId for upsert
      return await prisma.defaultCommand.upsert({
        where: { discordId: command.discordId },
        update: {
          name: command.name,
          description: command.description,
          cooldown: command.cooldown,
          permissions: command.permissions,
          enabled: command.enabled,
          parentId: command.parentId || null,
        },
        create: {
          discordId: command.discordId,
          name: command.name,
          description: command.description,
          cooldown: command.cooldown,
          permissions: command.permissions,
          enabled: command.enabled,
          parentId: command.parentId || null,
        },
      });
    } else if (command.parentId) {
      // Subcommand - upsert by name + parentId to prevent duplicates
      const existingSubcommand = await prisma.defaultCommand.findFirst({
        where: {
          name: command.name,
          parentId: command.parentId,
        },
      });

      if (existingSubcommand) {
        // Update existing subcommand
        return await prisma.defaultCommand.update({
          where: { id: existingSubcommand.id },
          data: {
            description: command.description,
            cooldown: command.cooldown,
            permissions: command.permissions,
            enabled: command.enabled,
          },
        });
      } else {
        // Create new subcommand
        return await prisma.defaultCommand.create({
          data: {
            name: command.name,
            description: command.description,
            cooldown: command.cooldown,
            permissions: command.permissions,
            enabled: command.enabled,
            parentId: command.parentId || null,
          },
        });
      }
    } else {
      throw new Error(
        "Invalid command data: parentId is required for subcommands, discordId is required for main commands"
      );
    }
  }

  // Get command by ID
  static async getCommandById(id: number): Promise<DefaultCommand | null> {
    return await prisma.defaultCommand.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  // Get command by Discord ID
  static async getCommandByDiscordId(discordId: bigint) {
    return await prisma.defaultCommand.findUnique({
      where: { discordId },
      include: {
        category: true,
      },
    });
  }

  // Get all main commands (no parent)
  static async getAllMainCommands() {
    return await prisma.defaultCommand.findMany({
      where: { parentId: null },
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    });
  }

  // Update command enabled status
  static async updateCommandEnabled(id: number, enabled: boolean): Promise<DefaultCommand> {
    return await prisma.defaultCommand.update({
      where: { id },
      data: { enabled },
    });
  }

  // Update command cooldown
  static async updateCommandCooldown(id: number, cooldown: number): Promise<DefaultCommand> {
    return await prisma.defaultCommand.update({
      where: { id },
      data: { cooldown },
    });
  }

  // Delete command
  static async deleteCommand(id: number): Promise<DefaultCommand> {
    return await prisma.defaultCommand.delete({
      where: { id },
    });
  }
}

export class CommandCategoryService {
  // Get category by ID
  static async getCategoryById(id: number): Promise<CommandCategory | null> {
    return await prisma.commandCategory.findUnique({
      where: { id },
      include: {
        commands: true,
      },
    });
  }

  // Get category by name
  static async getCategoryByName(name: string): Promise<CommandCategory | null> {
    return await prisma.commandCategory.findFirst({
      where: { name },
      include: {
        commands: true,
      },
    });
  }

  // Get all categories
  static async getAllCategories(): Promise<CommandCategory[]> {
    return await prisma.commandCategory.findMany({
      include: {
        commands: true,
      },
      orderBy: { name: "asc" },
    });
  }

  // Create category
  static async createCategory(data: {
    name: string;
    description: string;
  }): Promise<CommandCategory> {
    return await prisma.commandCategory.create({
      data,
    });
  }

  // Update category
  static async updateCategory(
    id: number,
    data: { name?: string; description?: string }
  ): Promise<CommandCategory> {
    return await prisma.commandCategory.update({
      where: { id },
      data,
    });
  }

  // Delete category
  static async deleteCategory(id: number): Promise<CommandCategory> {
    return await prisma.commandCategory.delete({
      where: { id },
    });
  }
}

// Export Prisma client for direct use if needed
export { prisma };
