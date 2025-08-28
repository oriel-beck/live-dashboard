import { PrismaClient, DefaultCommand, CommandCategory } from "@prisma/client";
import logger from "./utils/logger";

// Create Prisma client instance
export const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

// Extended types for commands with subcommands
export type DefaultCommandWithSubcommands = DefaultCommand & {
  subcommands?: DefaultCommandWithSubcommands[];
};

export type DefaultCommandWithCategory = DefaultCommand & {
  category: CommandCategory | null;
};

// Initialize database connection
export async function initializeDatabase() {
  try {
    await prisma.$connect();
    logger.info("[Database] Prisma connected successfully");

    // Test the connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info("[Database] Database connection tested successfully");
  } catch (error) {
    logger.error("[Database] Error connecting to database:", error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  await prisma.$disconnect();
  logger.info("[Database] Prisma disconnected");
}

// Type aliases for better compatibility with existing code
export type DbDefaultCommand = {
  id: number;
  name: string;
  description: string;
  permissions: bigint;
  enabled: boolean;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  subcommands?: DbDefaultCommand[];
};

export type DbCommandConfig = {
  guildId: string;
  commandId: number;
  enabled: boolean;
  whitelistedRoles: string[];
  blacklistedRoles: string[];
  whitelistedChannels: string[];
  blacklistedChannels: string[];
  bypassRoles: string[];
  createdAt: Date;
  updatedAt: Date;
  defaultCommand?: DbDefaultCommand;
};

// Return types for getCommandConfigById
export interface CommandConfigResult {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  permissions: string;
  enabled: boolean;
  whitelistedRoles: string[];
  blacklistedRoles: string[];
  whitelistedChannels: string[];
  blacklistedChannels: string[];
  bypassRoles: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  subcommands: Record<string, any>;
  parentId?: number;
  categoryId?: number;
  discordId?: bigint;
}

export interface CommandConfigWithSubcommandResult extends CommandConfigResult {
  subcommand: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  };
}

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

  // Get all main commands (for dashboard listing)
  static async getAllMainCommands(): Promise<DefaultCommand[]> {
    return await prisma.defaultCommand.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
    });
  }

  // Get subcommands by parent name
  static async getSubcommandsByParentName(
    parentName: string
  ): Promise<DefaultCommand[]> {
    const parent = await prisma.defaultCommand.findFirst({
      where: { name: parentName, parentId: null },
    });

    if (!parent) return [];

    return await prisma.defaultCommand.findMany({
      where: { parentId: parent.id },
      orderBy: { name: "asc" },
    });
  }

  static async getCommandById(
    commandId: number,
    subcommandName?: string,
    includeSubcommands: boolean = false
  ): Promise<
    (DefaultCommandWithSubcommands & DefaultCommandWithCategory) | null
  > {
    const result = await prisma.defaultCommand.findUnique({
      where: { id: commandId },
      include: {
        category: true,
        ...(includeSubcommands
          ? {
              subcommands: {
                orderBy: { name: "asc" },
                include: {
                  subcommands: {
                    orderBy: { name: "asc" },
                    include: {
                      category: true,
                    },
                  },
                  category: true,
                },
              },
            }
          : subcommandName
          ? {
              subcommands: {
                where: { name: subcommandName },
              },
            }
          : {}),
      },
    });
    
    // Removed verbose debug logging
    
    return result;
  }

  // Get command by ID
  static async getCommandByDiscordId(
    commandId: string,
    subcommandName?: string,
    includeSubcommands: boolean = false
  ): Promise<(DefaultCommandWithSubcommands & DefaultCommandWithCategory) | null> {
    return await prisma.defaultCommand.findUnique({
      where: { discordId: BigInt(commandId) },
      include: {
        category: true,
        ...(includeSubcommands
          ? {
              subcommands: {
                orderBy: { name: "asc" },
                include: {
                  subcommands: {
                    orderBy: { name: "asc" },
                    include: {
                      category: true,
                    },
                  },
                  category: true,
                },
              },
            }
          : subcommandName
          ? {
              subcommands: {
                where: { name: subcommandName },
                include: {
                  category: true,
                },
              },
            }
          : {}),
      },
    });
  }

  // Get all main commands with optional subcommands
  static async getAllMainCommandsWithSubcommands(
    includeSubcommands: boolean = false
  ): Promise<(DefaultCommandWithSubcommands & DefaultCommandWithCategory)[]> {
    const commands = await prisma.defaultCommand.findMany({
      where: { parentId: null },
      include: {
        category: true,
        ...(includeSubcommands
          ? {
              subcommands: {
                orderBy: { name: "asc" },
                include: {
                  subcommands: {
                    orderBy: { name: "asc" },
                    include: {
                      category: true,
                    },
                  },
                  category: true,
                },
              },
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return commands;
  }

  // Get subcommands by parent ID
  static async getSubcommandsByParentId(
    parentId: number
  ): Promise<(DefaultCommandWithSubcommands & DefaultCommandWithCategory)[]> {
    return await prisma.defaultCommand.findMany({
      where: { parentId: parentId },
      include: {
        category: true,
        subcommands: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  }
}

// Simple in-memory cache for guild command configs (10 minute TTL)
const configCache = new Map<string, { data: any; expires: number }>();

export class CommandConfigService {
  // Get command config by commandId with default fallback
  static async getCommandConfig(
    guildId: string,
    commandId: number,
    subcommandName?: string
  ): Promise<any | null> {

    // Get default command
    const defaultCommand = await DefaultCommandService.getCommandById(
      commandId,
      subcommandName || undefined,
      false // includeSubcommands - we don't need subcommands here, just category
    );
    if (!defaultCommand) {
      // Command doesn't exist at all - this is the only case we return null
      return null;
    }
    
    // Removed verbose debug logging

    // Get guild config if it exists
    const guildConfig = await prisma.guildCommandConfig.findUnique({
      where: {
        guildId_commandId: {
          guildId,
          commandId: defaultCommand.id,
        },
      },
    });

    // Always merge default + guild config (guild config can be null)
    const result = {
      id: defaultCommand.id.toString(),
      name: defaultCommand.name,
      description: defaultCommand.description,
      cooldown: defaultCommand.cooldown,
      permissions: defaultCommand.permissions.toString(),
      // If the default command is disabled, the guild config should be disabled too
      enabled: !defaultCommand.enabled
        ? false
        : guildConfig?.enabled ?? defaultCommand.enabled,
      whitelistedRoles: guildConfig?.whitelistedRoles || [],
      blacklistedRoles: guildConfig?.blacklistedRoles || [],
      whitelistedChannels: guildConfig?.whitelistedChannels || [],
      blacklistedChannels: guildConfig?.blacklistedChannels || [],
      bypassRoles: guildConfig?.bypassRoles || [],
      createdAt: guildConfig?.createdAt || null,
      updatedAt: guildConfig?.updatedAt || null,
      categoryId: defaultCommand.categoryId,
      category: defaultCommand.category,
    };

    return result;
  }

  // Get all main commands for a guild
  static async getGuildCommands(
    guildId: string,
    includeSubcommands: boolean = false
  ): Promise<any[]> {
    const mainCommands =
      await DefaultCommandService.getAllMainCommandsWithSubcommands(
        includeSubcommands
      );
    const result: any[] = [];

    for (const cmd of mainCommands) {
      const config = await this.getCommandConfig(guildId, cmd.id);
      if (config) {
        if (
          includeSubcommands &&
          cmd.subcommands &&
          cmd.subcommands.length > 0
        ) {
          // Build hierarchical subcommand structure
          const subcommandConfigs = await this.buildSubcommandConfigs(
            guildId,
            cmd.subcommands
          );
          result.push({
            ...config,
            subcommands: subcommandConfigs,
          });
        } else {
          result.push({
            ...config,
            subcommands: {},
          });
        }
      }
    }

    return result;
  }

  // Helper method to build nested subcommand configurations
  private static async buildSubcommandConfigs(
    guildId: string,
    subcommands: DefaultCommandWithSubcommands[]
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const sub of subcommands) {
      const subConfig = await this.getCommandConfigById(guildId, sub.id);
      if (subConfig) {
        if (sub.subcommands && sub.subcommands.length > 0) {
          const nestedSubcommands = await this.buildSubcommandConfigs(
            guildId,
            sub.subcommands
          );
          result[sub.name] = {
            ...subConfig,
            subcommands: nestedSubcommands,
          };
        } else {
          result[sub.name] = subConfig;
        }
      }
    }

    return result;
  }

  // Update command config
  static async updateCommandConfig(
    guildId: string,
    commandId: number,
    updates: any,
    subcommandName?: string
  ): Promise<any> {
    const defaultCommand = await DefaultCommandService.getCommandById(
      commandId,
      subcommandName || undefined
    );

    if (!defaultCommand) {
      throw new Error("Command not found");
    }

    const result = await prisma.guildCommandConfig.upsert({
      where: {
        guildId_commandId: {
          guildId,
          commandId: defaultCommand.id,
        },
      },
      update: updates,
      create: {
        guildId,
        commandId: defaultCommand.id,
        enabled: true,
        whitelistedRoles: [],
        blacklistedRoles: [],
        whitelistedChannels: [],
        blacklistedChannels: [],
        bypassRoles: [],
        ...updates,
      },
    });

    // Invalidate cache
    const cacheKey = `${guildId}:${commandId}${
      subcommandName ? `:${subcommandName}` : ""
    }`;
    configCache.delete(cacheKey);

    return result;
  }

  // Get command config by database ID with default fallback
  static async getCommandConfigById(
    guildId: string,
    id: number,
    subcommandName?: string,
    includeSubcommands: boolean = false
  ): Promise<CommandConfigResult | CommandConfigWithSubcommandResult | null> {

    // Get default command by database ID
    const defaultCommand = await DefaultCommandService.getCommandById(
      id,
      subcommandName,
      includeSubcommands
    );
    if (!defaultCommand) {
      return null;
    }

    // Determine if we need to fetch parent command
    const needsParentCommand = defaultCommand.parentId && !subcommandName;
    const commandIds = new Set<number>([defaultCommand.id]);

    if (needsParentCommand && defaultCommand.parentId) {
      commandIds.add(defaultCommand.parentId);
    }

    // If subcommandName is provided and this is a main command, also fetch subcommand config
    if (
      subcommandName &&
      !defaultCommand.parentId &&
      defaultCommand.subcommands
    ) {
      const subcommand = defaultCommand.subcommands.find(
        (sub) => sub.name === subcommandName
      );
      if (subcommand) {
        commandIds.add(subcommand.id);
      }
    }

    // Batch fetch all required guild configs in a single query
    const guildConfigs = await prisma.guildCommandConfig.findMany({
      where: {
        guildId,
        commandId: { in: Array.from(commandIds) },
      },
    });

    // Create a map for quick lookup
    const guildConfigMap = new Map(
      guildConfigs.map((config) => [config.commandId, config])
    );

    // Handle subcommand with parent command case
    if (needsParentCommand && defaultCommand.parentId) {
      const parentCommand = await DefaultCommandService.getCommandById(
        defaultCommand.parentId,
        undefined,
        includeSubcommands
      );
      if (!parentCommand) {
        return null;
      }

      const mainGuildConfig = guildConfigMap.get(parentCommand.id);
      const subGuildConfig = guildConfigMap.get(defaultCommand.id);

      const result: CommandConfigResult = {
        id: defaultCommand.id.toString(),
        name: defaultCommand.name,
        description: defaultCommand.description,
        cooldown: defaultCommand.cooldown,
        permissions: defaultCommand.permissions.toString(),
        enabled: subGuildConfig?.enabled ?? defaultCommand.enabled,
        whitelistedRoles: mainGuildConfig?.whitelistedRoles ?? [],
        blacklistedRoles: mainGuildConfig?.blacklistedRoles ?? [],
        whitelistedChannels: mainGuildConfig?.whitelistedChannels ?? [],
        blacklistedChannels: mainGuildConfig?.blacklistedChannels ?? [],
        bypassRoles: mainGuildConfig?.bypassRoles ?? [],
        createdAt: mainGuildConfig?.createdAt ?? null,
        updatedAt: mainGuildConfig?.updatedAt ?? null,
        subcommands: {},
      };

      return result;
    }

    // Handle main command with specific subcommand case
    if (
      subcommandName &&
      !defaultCommand.parentId &&
      defaultCommand.subcommands
    ) {
      const subcommand = defaultCommand.subcommands.find(
        (sub) => sub.name === subcommandName
      );
      if (!subcommand) {
        return null;
      }

      const mainGuildConfig = guildConfigMap.get(defaultCommand.id);
      const subGuildConfig = guildConfigMap.get(subcommand.id);

      const result: CommandConfigWithSubcommandResult = {
        id: defaultCommand.id.toString(),
        name: defaultCommand.name,
        description: defaultCommand.description,
        cooldown: defaultCommand.cooldown,
        permissions: defaultCommand.permissions.toString(),
        enabled: mainGuildConfig?.enabled ?? defaultCommand.enabled,
        whitelistedRoles: mainGuildConfig?.whitelistedRoles ?? [],
        blacklistedRoles: mainGuildConfig?.blacklistedRoles ?? [],
        whitelistedChannels: mainGuildConfig?.whitelistedChannels ?? [],
        blacklistedChannels: mainGuildConfig?.blacklistedChannels ?? [],
        bypassRoles: mainGuildConfig?.bypassRoles ?? [],
        createdAt: mainGuildConfig?.createdAt ?? null,
        updatedAt: mainGuildConfig?.updatedAt ?? null,
        subcommands: {},
        subcommand: {
          id: subcommand.id.toString(),
          name: subcommand.name,
          description: subcommand.description,
          enabled: subGuildConfig?.enabled ?? subcommand.enabled,
        },
      };

      return result;
    }

    // Regular command request
    const guildConfig = guildConfigMap.get(defaultCommand.id);

    const result: CommandConfigResult = {
      id: defaultCommand.id.toString(),
      name: defaultCommand.name,
      description: defaultCommand.description,
      cooldown: defaultCommand.cooldown,
      permissions: defaultCommand.permissions.toString(),
      enabled: guildConfig?.enabled ?? defaultCommand.enabled,
      whitelistedRoles: guildConfig?.whitelistedRoles ?? [],
      blacklistedRoles: guildConfig?.blacklistedRoles ?? [],
      whitelistedChannels: guildConfig?.whitelistedChannels ?? [],
      blacklistedChannels: guildConfig?.blacklistedChannels ?? [],
      bypassRoles: guildConfig?.bypassRoles ?? [],
      createdAt: guildConfig?.createdAt ?? null,
      updatedAt: guildConfig?.updatedAt ?? null,
      subcommands: {},
    };

    // Include subcommands if requested and this is a main command
    if (
      includeSubcommands &&
      defaultCommand.subcommands &&
      !defaultCommand.parentId
    ) {
      const subcommandConfigs = await this.buildSubcommandConfigs(
        guildId,
        defaultCommand.subcommands
      );
      result.subcommands = subcommandConfigs;
    }

    return result;
  }

  // Get command config by discord slash command ID with default fallback
  static async getCommandConfigByDiscordId(
    guildId: string,
    discordCommandId: string,
    subcommandName?: string,
    includeSubcommands: boolean = false
  ): Promise<any | null> {

    if (subcommandName) {
      // When subcommandName is provided, return both main command and specific subcommand
      const mainCommand = await DefaultCommandService.getCommandByDiscordId(
        discordCommandId,
        subcommandName,
        includeSubcommands
      );
      if (!mainCommand) return null;

      // Get guild configs for both main command and subcommand
      const mainGuildConfig = await prisma.guildCommandConfig.findUnique({
        where: {
          guildId_commandId: {
            guildId,
            commandId: mainCommand.id,
          },
        },
      });

      const subcommand = mainCommand.subcommands?.find(
        (sub) => sub.name === subcommandName
      );
      if (!subcommand) return null;

      const subGuildConfig = await prisma.guildCommandConfig.findUnique({
        where: {
          guildId_commandId: {
            guildId,
            commandId: subcommand.id,
          },
        },
      });

      const result = {
        command: {
          id: mainCommand.id.toString(),
          discordId: mainCommand.discordId?.toString(),
          name: mainCommand.name,
          description: mainCommand.description,
          cooldown: mainCommand.cooldown,
          permissions: mainCommand.permissions.toString(),
          enabled: !mainCommand.enabled
            ? false
            : mainGuildConfig?.enabled ?? mainCommand.enabled,
          whitelistedRoles: mainGuildConfig?.whitelistedRoles || [],
          blacklistedRoles: mainGuildConfig?.blacklistedRoles || [],
          whitelistedChannels: mainGuildConfig?.whitelistedChannels || [],
          blacklistedChannels: mainGuildConfig?.blacklistedChannels || [],
          bypassRoles: mainGuildConfig?.bypassRoles || [],
          createdAt: mainGuildConfig?.createdAt || null,
          updatedAt: mainGuildConfig?.updatedAt || null,
        },
        subcommand: {
          id: subcommand.id.toString(),
          name: subcommand.name,
          description: subcommand.description,
          cooldown: subcommand.cooldown,
          permissions: subcommand.permissions.toString(),
          enabled: !subcommand.enabled
            ? false
            : subGuildConfig?.enabled ?? subcommand.enabled,
          // Inherit from parent command
          whitelistedRoles: mainGuildConfig?.whitelistedRoles || [],
          blacklistedRoles: mainGuildConfig?.blacklistedRoles || [],
          whitelistedChannels: mainGuildConfig?.whitelistedChannels || [],
          blacklistedChannels: mainGuildConfig?.blacklistedChannels || [],
          bypassRoles: mainGuildConfig?.bypassRoles || [],
          parentId: mainCommand.id.toString(),
          createdAt: subGuildConfig?.createdAt || null,
          updatedAt: subGuildConfig?.updatedAt || null,
        },
      };

      return result;
    }

    // Regular main command request
    const defaultCommand = await DefaultCommandService.getCommandByDiscordId(
      discordCommandId
    );
    if (!defaultCommand) {
      return null;
    }

    // Get guild config if it exists
    const guildConfig = await prisma.guildCommandConfig.findUnique({
      where: {
        guildId_commandId: {
          guildId,
          commandId: defaultCommand.id,
        },
      },
    });

    // Main command - use its own config
    const result = {
      id: defaultCommand.id.toString(),
      discordId: defaultCommand.discordId?.toString(),
      name: defaultCommand.name,
      description: defaultCommand.description,
      cooldown: defaultCommand.cooldown,
      permissions: defaultCommand.permissions.toString(),
      enabled: !defaultCommand.enabled
        ? false
        : guildConfig?.enabled ?? defaultCommand.enabled,
      whitelistedRoles: guildConfig?.whitelistedRoles || [],
      blacklistedRoles: guildConfig?.blacklistedRoles || [],
      whitelistedChannels: guildConfig?.whitelistedChannels || [],
      blacklistedChannels: guildConfig?.blacklistedChannels || [],
      bypassRoles: guildConfig?.bypassRoles || [],
      createdAt: guildConfig?.createdAt || null,
      updatedAt: guildConfig?.updatedAt || null,
      subcommands: {},
    };

    // Include subcommands if requested
    if (includeSubcommands && defaultCommand.subcommands) {
      const subcommandConfigs = await this.buildSubcommandConfigs(
        guildId,
        defaultCommand.subcommands
      );
      result.subcommands = subcommandConfigs;
    }

    return result;
  }

  // Update command config by ID (handles both Discord IDs and database IDs)
  static async updateCommandConfigById(
    guildId: string,
    commandId: string,
    updates: any,
    subcommandName?: string
  ): Promise<any> {
    let targetCommandId: number;
    let isSubcommand = false;

    logger.debug(`[Database] updateCommandConfigById called: guildId=${guildId}, commandId=${commandId}`);

    if (subcommandName) {
      // Get subcommand ID by name within the parent command
      const parentCommand = await DefaultCommandService.getCommandByDiscordId(
        commandId
      );
      if (!parentCommand) {
        throw new Error("Parent command not found");
      }

      const subcommand = parentCommand.subcommands?.find(
        (sub) => sub.name === subcommandName
      );
      if (!subcommand) {
        throw new Error("Subcommand not found");
      }

      targetCommandId = subcommand.id;
      isSubcommand = true;

      // For subcommands, only allow updating the enabled field
      const allowedFields = ["enabled"];
      const filteredUpdates = Object.keys(updates)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error(
          'No valid fields to update for subcommand. Only "enabled" is allowed.'
        );
      }

      updates = filteredUpdates;
    } else {
      // For now, just treat all IDs as database IDs since that's what the frontend is sending
      targetCommandId = +commandId;

      // Verify that the command exists
      const command = await DefaultCommandService.getCommandById(+commandId);
      if (!command) {
        throw new Error(`Command with ID ${+commandId} not found`);
      }
    }

    // Removed verbose debug logging

    const result = await prisma.guildCommandConfig.upsert({
      where: {
        guildId_commandId: {
          guildId,
          commandId: targetCommandId,
        },
      },
      update: updates,
      create: {
        guildId,
        commandId: targetCommandId,
        enabled: true,
        // Only set these for main commands
        ...(isSubcommand
          ? {}
          : {
              whitelistedRoles: [],
              blacklistedChannels: [],
              bypassRoles: [],
            }),
        ...updates,
      },
    });

    logger.debug(`[Database] Command config updated successfully for guild ${guildId}, command ${targetCommandId}`);

    // Invalidate cache
    const cacheKey = `${guildId}:${commandId}${
      subcommandName ? `:${subcommandName}` : ""
    }`;
    configCache.delete(cacheKey);

    return result;
  }

  // Invalidate cache when config changes
  static invalidateCache(
    guildId: string,
    commandName: string,
    subcommandName?: string
  ): void {
    const cacheKey = `${guildId}:${commandName}${
      subcommandName ? `:${subcommandName}` : ""
    }`;
    configCache.delete(cacheKey);
  }

  // Invalidate cache by command ID
  static invalidateCacheById(
    guildId: string,
    commandId: string,
    subcommandName?: string
  ): void {
    const cacheKey = `${guildId}:${commandId}${
      subcommandName ? `:${subcommandName}` : ""
    }`;
    configCache.delete(cacheKey);
  }
}
