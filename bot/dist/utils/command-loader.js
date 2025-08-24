"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandLoader = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const command_1 = require("../types/command");
class CommandLoader {
    static async loadCommandFromFile(filePath) {
        try {
            delete require.cache[require.resolve(filePath)];
            const commandModule = require(filePath);
            for (const [exportName, exportValue] of Object.entries(commandModule)) {
                if (typeof exportValue === 'function' &&
                    exportValue.prototype instanceof command_1.BaseCommand) {
                    const CommandClass = exportValue;
                    const commandInstance = new CommandClass();
                    console.log(`[CommandLoader] Loaded command: ${commandInstance.name} from ${exportName}`);
                    return commandInstance;
                }
            }
            if (commandModule.default &&
                typeof commandModule.default === 'function' &&
                commandModule.default.prototype instanceof command_1.BaseCommand) {
                const CommandClass = commandModule.default;
                const commandInstance = new CommandClass();
                console.log(`[CommandLoader] Loaded command: ${commandInstance.name} from default export`);
                return commandInstance;
            }
            console.warn(`[CommandLoader] No BaseCommand class found in ${filePath}`);
            return null;
        }
        catch (error) {
            console.error(`[CommandLoader] Error loading command from ${filePath}:`, error);
            return null;
        }
    }
    static async loadAllCommands() {
        const commands = [];
        const commandsPath = (0, path_1.join)(__dirname, '../commands');
        try {
            const commandFiles = (0, fs_1.readdirSync)(commandsPath)
                .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
                .filter(file => file !== 'index.ts');
            console.log(`[CommandLoader] Found ${commandFiles.length} command files:`, commandFiles);
            for (const file of commandFiles) {
                const filePath = (0, path_1.join)(commandsPath, file);
                const command = await this.loadCommandFromFile(filePath);
                if (command) {
                    commands.push(command);
                }
            }
            console.log(`[CommandLoader] Successfully loaded ${commands.length} commands`);
            return commands;
        }
        catch (error) {
            console.error('[CommandLoader] Error reading commands directory:', error);
            return [];
        }
    }
    static async loadAllCommandsRecursive() {
        const commands = [];
        const loadFromDirectory = async (dirPath) => {
            try {
                const items = (0, fs_1.readdirSync)(dirPath, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = (0, path_1.join)(dirPath, item.name);
                    if (item.isDirectory()) {
                        await loadFromDirectory(fullPath);
                    }
                    else if (item.isFile() &&
                        item.name.endsWith('.ts') &&
                        !item.name.endsWith('.d.ts') &&
                        item.name !== 'index.ts') {
                        const command = await this.loadCommandFromFile(fullPath);
                        if (command) {
                            commands.push(command);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`[CommandLoader] Error reading directory ${dirPath}:`, error);
            }
        };
        const commandsPath = (0, path_1.join)(__dirname, '../commands');
        await loadFromDirectory(commandsPath);
        console.log(`[CommandLoader] Successfully loaded ${commands.length} commands recursively`);
        return commands;
    }
    static validateCommand(command) {
        try {
            if (!command.data) {
                console.error(`[CommandLoader] Command missing data property`);
                return false;
            }
            if (!command.data.name) {
                console.error(`[CommandLoader] Command missing name`);
                return false;
            }
            if (!command.data.description) {
                console.error(`[CommandLoader] Command ${command.data.name} missing description`);
                return false;
            }
            if (typeof command.execute !== 'function') {
                console.error(`[CommandLoader] Command ${command.data.name} missing execute method`);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error(`[CommandLoader] Error validating command:`, error);
            return false;
        }
    }
}
exports.CommandLoader = CommandLoader;
//# sourceMappingURL=command-loader.js.map