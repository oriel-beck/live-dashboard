// Types manually defined for dashboard use
export type UserGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features?: string[];
  botHasAccess?: boolean;
};

export type User = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  guilds?: UserGuild[];
};

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

