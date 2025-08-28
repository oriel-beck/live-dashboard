import { z } from 'zod';
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    message?: string | undefined;
    error?: string | undefined;
    data?: unknown;
}, {
    success: boolean;
    message?: string | undefined;
    error?: string | undefined;
    data?: unknown;
}>;
export declare const CacheEntrySchema: z.ZodObject<{
    data: z.ZodUnknown;
    expires: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    expires: number;
    data?: unknown;
}, {
    expires: number;
    data?: unknown;
}>;
export declare const GuildDataResponseSchema: z.ZodObject<{
    guildInfo: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        icon: z.ZodNullable<z.ZodString>;
        owner: z.ZodBoolean;
        permissions: z.ZodString;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
    }, {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
    }>;
    roles: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    channels: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    guildInfo: {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
    };
    roles: {
        id: string;
        name: string;
        permissions: string;
        color: number;
        hoist: boolean;
        position: number;
        managed: boolean;
        mentionable: boolean;
    }[];
    channels: {
        id: string;
        name: string;
        type: number;
        position: number;
        parent_id: string | null;
        permission_overwrites: unknown[];
    }[];
}, {
    guildInfo: {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
    };
    roles: {
        id: string;
        name: string;
        permissions: string;
        color: number;
        hoist: boolean;
        position: number;
        managed: boolean;
        mentionable: boolean;
    }[];
    channels: {
        id: string;
        name: string;
        type: number;
        position: number;
        parent_id: string | null;
        permission_overwrites: unknown[];
    }[];
}>;
export declare const MessageSendRequestSchema: z.ZodObject<{
    channelId: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
    embeds: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    components: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, "strip", z.ZodTypeAny, {
    channelId: string;
    content?: string | undefined;
    embeds?: unknown[] | undefined;
    components?: unknown[] | undefined;
}, {
    channelId: string;
    content?: string | undefined;
    embeds?: unknown[] | undefined;
    components?: unknown[] | undefined;
}>;
export declare const MessageSendResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    messageId: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    messageId?: string | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    messageId?: string | undefined;
}>;
export declare const HealthCheckResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    timestamp: string;
}, {
    message: string;
    success: boolean;
    timestamp: string;
}>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
    data?: T;
};
export type CacheEntry<T = unknown> = z.infer<typeof CacheEntrySchema> & {
    data: T;
};
export type GuildDataResponse = z.infer<typeof GuildDataResponseSchema>;
export type MessageSendRequest = z.infer<typeof MessageSendRequestSchema>;
export type MessageSendResponse = z.infer<typeof MessageSendResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
//# sourceMappingURL=api.d.ts.map