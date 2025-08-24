"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl ?? this.getDefaultApiUrl();
        console.log(`[ApiClient] Using base URL: ${this.baseUrl}`);
    }
    getDefaultApiUrl() {
        const isProduction = process.env.NODE_ENV === "production";
        console.log(`[ApiClient] Environment detection: NODE_ENV=${process.env.NODE_ENV}, isProduction=${isProduction}`);
        const url = isProduction ? "http://api:3000" : "http://localhost:3000";
        return url;
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async post(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async put(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async getGuildCommandConfigs(guildId, withSubcommands = false) {
        const params = withSubcommands ? "?withSubcommands=true" : "";
        return this.get(`/guilds/${guildId}/commands${params}`);
    }
    async getCommandConfigById(guildId, commandId, withSubcommands = false) {
        const params = withSubcommands ? "?withSubcommands=true" : "";
        return this.get(`/guilds/${guildId}/commands/${commandId}${params}`);
    }
    async getSubcommandConfig(guildId, commandId, subcommandName, withSubcommands = false) {
        const params = withSubcommands ? "?withSubcommands=true" : "";
        return this.get(`/guilds/${guildId}/commands/${commandId}/${subcommandName}${params}`);
    }
    async getCommandConfig(guildId, commandName) {
        try {
            const allCommands = await this.getGuildCommandConfigs(guildId);
            const command = Object.values(allCommands).find((cmd) => cmd.name === commandName);
            return command || null;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("404")) {
                return null;
            }
            throw error;
        }
    }
    async updateCommandConfigById(guildId, commandId, updates) {
        return this.put(`/guilds/${guildId}/commands/${commandId}`, updates);
    }
    async updateSubcommandConfigById(guildId, commandId, subcommandName, updates) {
        return this.put(`/guilds/${guildId}/commands/${commandId}/${subcommandName}`, updates);
    }
    async updateCommandConfig(guildId, commandName, updates) {
        const command = await this.getCommandConfig(guildId, commandName);
        if (!command) {
            throw new Error(`Command ${commandName} not found`);
        }
        return this.updateCommandConfigById(guildId, command.id, updates);
    }
    async updateSubcommandConfig(guildId, commandName, subcommandName, updates) {
        const command = await this.getCommandConfig(guildId, commandName);
        if (!command) {
            throw new Error(`Command ${commandName} not found`);
        }
        return this.updateSubcommandConfigById(guildId, command.id, subcommandName, updates);
    }
    async registerDefaultCommand(command) {
        return this.post("/commands/register", command);
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=api-client.js.map