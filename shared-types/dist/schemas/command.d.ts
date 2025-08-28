import { z } from 'zod';
export declare const CommandPermissionsSchema: z.ZodObject<{
    whitelistedRoles: z.ZodArray<z.ZodString, "many">;
    blacklistedRoles: z.ZodArray<z.ZodString, "many">;
    whitelistedChannels: z.ZodArray<z.ZodString, "many">;
    blacklistedChannels: z.ZodArray<z.ZodString, "many">;
    bypassRoles: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    whitelistedRoles: string[];
    blacklistedRoles: string[];
    whitelistedChannels: string[];
    blacklistedChannels: string[];
    bypassRoles: string[];
}, {
    whitelistedRoles: string[];
    blacklistedRoles: string[];
    whitelistedChannels: string[];
    blacklistedChannels: string[];
    bypassRoles: string[];
}>;
export declare const CommandCategorySchema: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    commands: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodTypeAny>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    commands?: any[] | undefined;
}, {
    id: number;
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    commands?: any[] | undefined;
}>;
export declare const SubcommandConfigSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    cooldown: z.ZodNumber;
    permissions: z.ZodObject<{
        whitelistedRoles: z.ZodArray<z.ZodString, "many">;
        blacklistedRoles: z.ZodArray<z.ZodString, "many">;
        whitelistedChannels: z.ZodArray<z.ZodString, "many">;
        blacklistedChannels: z.ZodArray<z.ZodString, "many">;
        bypassRoles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    }, {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    permissions: {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    };
    enabled: boolean;
    cooldown: number;
}, {
    permissions: {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    };
    enabled: boolean;
    cooldown: number;
}>;
export declare const GuildCommandConfigSchema: z.ZodObject<{
    id: z.ZodString;
    commandName: z.ZodString;
    guildId: z.ZodString;
    enabled: z.ZodBoolean;
    cooldown: z.ZodNumber;
    permissions: z.ZodObject<{
        whitelistedRoles: z.ZodArray<z.ZodString, "many">;
        blacklistedRoles: z.ZodArray<z.ZodString, "many">;
        whitelistedChannels: z.ZodArray<z.ZodString, "many">;
        blacklistedChannels: z.ZodArray<z.ZodString, "many">;
        bypassRoles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    }, {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    }>;
    subcommands: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodBoolean;
        cooldown: z.ZodNumber;
        permissions: z.ZodObject<{
            whitelistedRoles: z.ZodArray<z.ZodString, "many">;
            blacklistedRoles: z.ZodArray<z.ZodString, "many">;
            whitelistedChannels: z.ZodArray<z.ZodString, "many">;
            blacklistedChannels: z.ZodArray<z.ZodString, "many">;
            bypassRoles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }>;
    }, "strip", z.ZodTypeAny, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    permissions: {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    };
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    cooldown: number;
    commandName: string;
    guildId: string;
    subcommands?: Record<string, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }> | undefined;
}, {
    id: string;
    permissions: {
        whitelistedRoles: string[];
        blacklistedRoles: string[];
        whitelistedChannels: string[];
        blacklistedChannels: string[];
        bypassRoles: string[];
    };
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    cooldown: number;
    commandName: string;
    guildId: string;
    subcommands?: Record<string, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }> | undefined;
}>;
export declare const CommandConfigDataSchema: z.ZodObject<{
    id: z.ZodNumber;
    discordId: z.ZodNullable<z.ZodBigInt>;
    name: z.ZodString;
    description: z.ZodString;
    cooldown: z.ZodNumber;
    permissions: z.ZodString;
    enabled: z.ZodBoolean;
    whitelistedRoles: z.ZodArray<z.ZodString, "many">;
    blacklistedRoles: z.ZodArray<z.ZodString, "many">;
    whitelistedChannels: z.ZodArray<z.ZodString, "many">;
    blacklistedChannels: z.ZodArray<z.ZodString, "many">;
    bypassRoles: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodNullable<z.ZodDate>;
    updatedAt: z.ZodNullable<z.ZodDate>;
    categoryId: z.ZodNullable<z.ZodNumber>;
    category: z.ZodNullable<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        description: z.ZodString;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
        commands: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodTypeAny>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        name: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        commands?: any[] | undefined;
    }, {
        id: number;
        name: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        commands?: any[] | undefined;
    }>>;
    subcommands: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodLazy<z.ZodType<any, z.ZodTypeDef, any>>>>;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    permissions: string;
    whitelistedRoles: string[];
    blacklistedRoles: string[];
    whitelistedChannels: string[];
    blacklistedChannels: string[];
    bypassRoles: string[];
    description: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    enabled: boolean;
    cooldown: number;
    discordId: bigint | null;
    categoryId: number | null;
    category: {
        id: number;
        name: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        commands?: any[] | undefined;
    } | null;
    subcommands?: Record<string, any> | undefined;
}, {
    id: number;
    name: string;
    permissions: string;
    whitelistedRoles: string[];
    blacklistedRoles: string[];
    whitelistedChannels: string[];
    blacklistedChannels: string[];
    bypassRoles: string[];
    description: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    enabled: boolean;
    cooldown: number;
    discordId: bigint | null;
    categoryId: number | null;
    category: {
        id: number;
        name: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
        commands?: any[] | undefined;
    } | null;
    subcommands?: Record<string, any> | undefined;
}>;
export declare const CommandConfigUpdateSchema: z.ZodIntersection<z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    whitelistedRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    blacklistedRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    whitelistedChannels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    blacklistedChannels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bypassRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    whitelistedRoles?: string[] | undefined;
    blacklistedRoles?: string[] | undefined;
    whitelistedChannels?: string[] | undefined;
    blacklistedChannels?: string[] | undefined;
    bypassRoles?: string[] | undefined;
    enabled?: boolean | undefined;
}, {
    whitelistedRoles?: string[] | undefined;
    blacklistedRoles?: string[] | undefined;
    whitelistedChannels?: string[] | undefined;
    blacklistedChannels?: string[] | undefined;
    bypassRoles?: string[] | undefined;
    enabled?: boolean | undefined;
}>, z.ZodRecord<z.ZodString, z.ZodUnknown>>;
export declare const CommandInfoSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
}, {
    name: string;
    description: string;
}>;
export declare const PermissionCheckResultSchema: z.ZodObject<{
    allowed: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
    bypassUsed: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    allowed: boolean;
    reason?: string | undefined;
    bypassUsed?: boolean | undefined;
}, {
    allowed: boolean;
    reason?: string | undefined;
    bypassUsed?: boolean | undefined;
}>;
export declare const CommandExecutionContextSchema: z.ZodObject<{
    interaction: z.ZodUnknown;
    definition: z.ZodUnknown;
    guildConfig: z.ZodObject<{
        id: z.ZodString;
        commandName: z.ZodString;
        guildId: z.ZodString;
        enabled: z.ZodBoolean;
        cooldown: z.ZodNumber;
        permissions: z.ZodObject<{
            whitelistedRoles: z.ZodArray<z.ZodString, "many">;
            blacklistedRoles: z.ZodArray<z.ZodString, "many">;
            whitelistedChannels: z.ZodArray<z.ZodString, "many">;
            blacklistedChannels: z.ZodArray<z.ZodString, "many">;
            bypassRoles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }>;
        subcommands: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            enabled: z.ZodBoolean;
            cooldown: z.ZodNumber;
            permissions: z.ZodObject<{
                whitelistedRoles: z.ZodArray<z.ZodString, "many">;
                blacklistedRoles: z.ZodArray<z.ZodString, "many">;
                whitelistedChannels: z.ZodArray<z.ZodString, "many">;
                blacklistedChannels: z.ZodArray<z.ZodString, "many">;
                bypassRoles: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            }, {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            }>;
        }, "strip", z.ZodTypeAny, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }>>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        createdAt: string;
        updatedAt: string;
        enabled: boolean;
        cooldown: number;
        commandName: string;
        guildId: string;
        subcommands?: Record<string, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }> | undefined;
    }, {
        id: string;
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        createdAt: string;
        updatedAt: string;
        enabled: boolean;
        cooldown: number;
        commandName: string;
        guildId: string;
        subcommands?: Record<string, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }> | undefined;
    }>;
    subcommandConfig: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        cooldown: z.ZodNumber;
        permissions: z.ZodObject<{
            whitelistedRoles: z.ZodArray<z.ZodString, "many">;
            blacklistedRoles: z.ZodArray<z.ZodString, "many">;
            whitelistedChannels: z.ZodArray<z.ZodString, "many">;
            blacklistedChannels: z.ZodArray<z.ZodString, "many">;
            bypassRoles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }, {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        }>;
    }, "strip", z.ZodTypeAny, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }, {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    guildConfig: {
        id: string;
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        createdAt: string;
        updatedAt: string;
        enabled: boolean;
        cooldown: number;
        commandName: string;
        guildId: string;
        subcommands?: Record<string, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }> | undefined;
    };
    interaction?: unknown;
    definition?: unknown;
    subcommandConfig?: {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    } | undefined;
}, {
    guildConfig: {
        id: string;
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        createdAt: string;
        updatedAt: string;
        enabled: boolean;
        cooldown: number;
        commandName: string;
        guildId: string;
        subcommands?: Record<string, {
            permissions: {
                whitelistedRoles: string[];
                blacklistedRoles: string[];
                whitelistedChannels: string[];
                blacklistedChannels: string[];
                bypassRoles: string[];
            };
            enabled: boolean;
            cooldown: number;
        }> | undefined;
    };
    interaction?: unknown;
    definition?: unknown;
    subcommandConfig?: {
        permissions: {
            whitelistedRoles: string[];
            blacklistedRoles: string[];
            whitelistedChannels: string[];
            blacklistedChannels: string[];
            bypassRoles: string[];
        };
        enabled: boolean;
        cooldown: number;
    } | undefined;
}>;
export declare const DefaultCommandRegistrationSchema: z.ZodObject<{
    discordId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    description: z.ZodString;
    permissions: z.ZodString;
    enabled: z.ZodBoolean;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cooldown: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    permissions: string;
    description: string;
    enabled: boolean;
    cooldown: number;
    parentId?: string | null | undefined;
    discordId?: string | null | undefined;
}, {
    name: string;
    permissions: string;
    description: string;
    enabled: boolean;
    cooldown: number;
    parentId?: string | null | undefined;
    discordId?: string | null | undefined;
}>;
export type CommandPermissions = z.infer<typeof CommandPermissionsSchema>;
export type CommandCategory = z.infer<typeof CommandCategorySchema>;
export type SubcommandConfig = z.infer<typeof SubcommandConfigSchema>;
export type GuildCommandConfig = z.infer<typeof GuildCommandConfigSchema>;
export type CommandConfigData = z.infer<typeof CommandConfigDataSchema>;
export type CommandConfigUpdate = z.infer<typeof CommandConfigUpdateSchema>;
export type CommandInfo = z.infer<typeof CommandInfoSchema>;
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;
export type CommandExecutionContext = z.infer<typeof CommandExecutionContextSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
//# sourceMappingURL=command.d.ts.map