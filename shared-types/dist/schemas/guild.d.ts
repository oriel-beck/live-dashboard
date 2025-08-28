import { z } from 'zod';
export declare const GuildRoleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    color: z.ZodNumber;
    hoist: z.ZodBoolean;
    position: z.ZodNumber;
    permissions: z.ZodString;
    managed: z.ZodBoolean;
    mentionable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    permissions: string;
    color: number;
    hoist: boolean;
    position: number;
    managed: boolean;
    mentionable: boolean;
}, {
    id: string;
    name: string;
    permissions: string;
    color: number;
    hoist: boolean;
    position: number;
    managed: boolean;
    mentionable: boolean;
}>;
export declare const GuildChannelSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodNumber;
    position: z.ZodNumber;
    parent_id: z.ZodNullable<z.ZodString>;
    permission_overwrites: z.ZodArray<z.ZodUnknown, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: number;
    position: number;
    parent_id: string | null;
    permission_overwrites: unknown[];
}, {
    id: string;
    name: string;
    type: number;
    position: number;
    parent_id: string | null;
    permission_overwrites: unknown[];
}>;
export declare const GuildInfoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    icon: z.ZodNullable<z.ZodString>;
    owner_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    icon: string | null;
    owner_id: string;
}, {
    id: string;
    name: string;
    icon: string | null;
    owner_id: string;
}>;
export declare const CachedGuildRoleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    position: z.ZodNumber;
    color: z.ZodNumber;
    permissions: z.ZodString;
    managed: z.ZodBoolean;
    lastUpdated: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    permissions: string;
    color: number;
    position: number;
    managed: boolean;
    lastUpdated: number;
}, {
    id: string;
    name: string;
    permissions: string;
    color: number;
    position: number;
    managed: boolean;
    lastUpdated: number;
}>;
export declare const CachedGuildChannelSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodNumber;
    parentId: z.ZodNullable<z.ZodString>;
    position: z.ZodNumber;
    lastUpdated: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: number;
    position: number;
    lastUpdated: number;
    parentId: string | null;
}, {
    id: string;
    name: string;
    type: number;
    position: number;
    lastUpdated: number;
    parentId: string | null;
}>;
export declare const CachedGuildInfoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    icon: z.ZodNullable<z.ZodString>;
    owner: z.ZodBoolean;
    lastUpdated: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    lastUpdated: number;
}, {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    lastUpdated: number;
}>;
export type GuildRole = z.infer<typeof GuildRoleSchema>;
export type GuildChannel = z.infer<typeof GuildChannelSchema>;
export type GuildInfo = z.infer<typeof GuildInfoSchema>;
export type CachedGuildRole = z.infer<typeof CachedGuildRoleSchema>;
export type CachedGuildChannel = z.infer<typeof CachedGuildChannelSchema>;
export type CachedGuildInfo = z.infer<typeof CachedGuildInfoSchema>;
//# sourceMappingURL=guild.d.ts.map