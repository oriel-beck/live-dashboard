import {
  ApiResponse,
  DefaultCommandRegistration,
  DefaultCommandRegistrationResponse,
  DefaultCommandRegistrationSchema,
  CommandConfigResult,
} from '@discord-bot/shared-types';
import logger from './logger';

// API client for bot to communicate with the API service
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? this.getDefaultApiUrl();
    logger.debug(`[ApiClient] Initialized with base URL: ${this.baseUrl}`);
  }

  private getDefaultApiUrl(): string {
    const url = process.env.API_BASE_URL  || "http://localhost:3000";
    return url;
  }

  async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }
      return await response.json() as T;
    } catch (error) {
      logger.error(`[ApiClient] GET request failed for endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }


  // Get command config by ID
  async getCommandConfig(
    guildId: string,
    commandId: string,
    withSubcommands: boolean = false,
    subcommandName?: string
  ): Promise<CommandConfigResult> {
    const params = new URLSearchParams();
    if (withSubcommands) params.append("withSubcommands", "true");
    if (subcommandName) params.append("subcommandName", subcommandName);
    
    const queryString = params.toString();
    const endpoint = `/guilds/${guildId}/commands/${commandId}`;
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    logger.debug(`[ApiClient] getCommandConfig: ${fullEndpoint}`);
    const response = await this.get<{ success: boolean; data: CommandConfigResult }>(fullEndpoint);
    return response.data;
  }


  // Register a default command in the database (upsert operation - creates or updates)
  async registerDefaultCommand(command: DefaultCommandRegistration): Promise<ApiResponse<DefaultCommandRegistrationResponse['data']>> {
    // Validate command data
    const validatedCommand = DefaultCommandRegistrationSchema.parse(command);
    return this.post<ApiResponse<DefaultCommandRegistrationResponse['data']>>("/commands/register", validatedCommand);
  }
}
