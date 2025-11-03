// Types manually defined for dashboard use
export type GuildRole = {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed: boolean;
};

export type GuildChannel = {
  id: string;
  name: string;
  position: number;
  botPermissions: string;
};

export type GuildInfo = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
};

export type BotProfile = {
  nickname: string | null;
  globalName: string | null;
  username: string;
  avatar: string | null;
  banner: string | null;
  permissions: string; // Bot's permissions in the guild as a string
};

