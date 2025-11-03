import { BotProfile } from './guild';

// BotConfig type manually defined since we only need the type, not the schema
export type BotConfig = {
  guildId: string;
  avatar?: string;
  banner?: string;
  nickname?: string;
};

// Bot Configuration Update Request type
export type BotConfigUpdateRequest = {
  avatar?: string | null;
  banner?: string | null;
  nickname?: string | null;
};

// Bot Configuration Response type (includes both guild and global profiles)
export type BotConfigResponse = {
  guildProfile: BotProfile;
  globalProfile: BotProfile;
};

