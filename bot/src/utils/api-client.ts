import logger from './logger';

// API client for bot to communicate with the API service
export class ApiClient {
  private static readonly API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

  static async fetchGuildData(guildId: string): Promise<{
    guildInfo: any;
    roles: any[];
    channels: any[];
  }> {
    const response = await fetch(`${this.API_BASE}/bot/guilds/${guildId}/data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BOT_TOKEN}`, // Bot token for internal API calls
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guild data: ${response.statusText}`);
    }

    const data = await response.json();
    return data as {
      guildInfo: any;
      roles: any[];
      channels: any[];
    };
  }

  static async sendCommandResponse(commandId: string, response: any) {
    const apiResponse = await fetch(`${this.API_BASE}/commands/${commandId}/response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
      },
      body: JSON.stringify(response),
    });

    if (!apiResponse.ok) {
      logger.error('Failed to send command response to API');
    }
  }

  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? this.getDefaultApiUrl();
  }

  private getDefaultApiUrl(): string {
    const isProduction = process.env.NODE_ENV === "production";
    const url = isProduction ? "http://api:3000" : "http://localhost:3000";
    return url;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }

  async put(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }

  async getGuildCommandConfigs(
    guildId: string,
    withSubcommands: boolean = false
  ): Promise<Record<string, any>> {
    const params = withSubcommands ? "?withSubcommands=true" : "";
    return this.get(`/guilds/${guildId}/commands${params}`);
  }

  // Get command config by ID
  async getCommandConfig(
    guildId: string,
    commandId: string,
    withSubcommands: boolean = false,
    subcommandName?: string
  ): Promise<any> {
    const params = new URLSearchParams();
    if (withSubcommands) params.append("withSubcommands", "true");
    if (subcommandName) params.append("subcommandName", subcommandName);
    
    const queryString = params.toString();
    return this.get(`/guilds/${guildId}/commands/${commandId}${queryString ? `?${queryString}` : ""}`);
  }

  // Update command config by ID
  async updateCommandConfig(
    guildId: string,
    commandId: string,
    updates: any
  ): Promise<any> {
    return this.put(`/guilds/${guildId}/commands/${commandId}`, updates);
  }

  // Update subcommand config by ID and subcommand name
  async updateSubcommandConfig(
    guildId: string,
    commandId: string,
    subcommandName: string,
    updates: any
  ): Promise<any> {
    return this.put(
      `/guilds/${guildId}/commands/${commandId}/${subcommandName}`,
      updates
    );
  }

  // Register a default command in the database (upsert operation - creates or updates)
  async registerDefaultCommand(command: {
    discordId?: string | null; // Only for main commands
    name: string;
    description: string;
    permissions: string;
    enabled: boolean;
    parentId?: string | null;
    cooldown: number;
  }): Promise<any> {
    return this.post("/commands/register", command);
  }
}
