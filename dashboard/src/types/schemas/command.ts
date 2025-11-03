import { CATEGORIES } from '../constants/categories';

// Command Config Result type
export type CommandConfigResult = {
  id: number;
  discordId: bigint | null;
  name: string;
  description: string;
  cooldown: number;
  permissions: string;
  enabled: boolean;
  parentId: number | null;
  categoryId: CATEGORIES | null;
  filePath: string | null;
};

// Extended type for command results with category information
export type CommandConfigResultWithSubcommands = CommandConfigResult & {
  subcommands?: CommandConfigResult[];
};

// Command permissions response type
export type CommandPermissionsResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

