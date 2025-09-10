// Database types
export interface DatabaseConnection {
  query: (sql: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

export interface CommandData {
  id: number;
  discordId: string | null;
  name: string;
  description: string;
  cooldown: number;
  permissions: string;
  enabled: boolean;
  parentId: number | null;
  categoryId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CategoryData {
  id: number;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
