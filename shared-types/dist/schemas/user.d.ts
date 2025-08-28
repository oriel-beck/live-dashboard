import { z } from 'zod';
export declare const UserGuildSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    icon: z.ZodNullable<z.ZodString>;
    owner: z.ZodBoolean;
    permissions: z.ZodString;
    features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    botHasAccess: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features?: string[] | undefined;
    botHasAccess?: boolean | undefined;
}, {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features?: string[] | undefined;
    botHasAccess?: boolean | undefined;
}>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    discriminator: z.ZodString;
    avatar: z.ZodNullable<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    guilds: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        icon: z.ZodNullable<z.ZodString>;
        owner: z.ZodBoolean;
        permissions: z.ZodString;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        botHasAccess: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
        botHasAccess?: boolean | undefined;
    }, {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
        botHasAccess?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email?: string | undefined;
    guilds?: {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
        botHasAccess?: boolean | undefined;
    }[] | undefined;
}, {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email?: string | undefined;
    guilds?: {
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
        features?: string[] | undefined;
        botHasAccess?: boolean | undefined;
    }[] | undefined;
}>;
export declare const SessionDataSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    accessToken: z.ZodOptional<z.ZodString>;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresAt?: number | undefined;
}, {
    userId?: string | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresAt?: number | undefined;
}>;
export declare const AuthStateSchema: z.ZodObject<{
    user: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        avatar: z.ZodNullable<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        guilds: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            icon: z.ZodNullable<z.ZodString>;
            owner: z.ZodBoolean;
            permissions: z.ZodString;
            features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            botHasAccess: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }, {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        email?: string | undefined;
        guilds?: {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }[] | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        email?: string | undefined;
        guilds?: {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }[] | undefined;
    }>>;
    isAuthenticated: z.ZodBoolean;
    isLoading: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        email?: string | undefined;
        guilds?: {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }[] | undefined;
    } | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        email?: string | undefined;
        guilds?: {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
            features?: string[] | undefined;
            botHasAccess?: boolean | undefined;
        }[] | undefined;
    } | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}>;
export type UserGuild = z.infer<typeof UserGuildSchema>;
export type User = z.infer<typeof UserSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type AuthState = z.infer<typeof AuthStateSchema>;
//# sourceMappingURL=user.d.ts.map