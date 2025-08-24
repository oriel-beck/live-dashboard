"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCommand = void 0;
class BaseCommand {
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand) {
            const methodName = subcommand.replace(/-/g, '_');
            const method = this[methodName];
            if (typeof method === 'function') {
                await method.call(this, interaction);
            }
            else {
                console.error(`[BaseCommand] Subcommand method '${methodName}' not found for command '${this.name}'`);
                await interaction.reply({
                    content: "This subcommand is not implemented yet.",
                    flags: ['Ephemeral'],
                });
            }
        }
        else {
            if (typeof this.run === 'function') {
                await this.run.call(this, interaction);
            }
            else {
                console.error(`[BaseCommand] Run method not found for command '${this.name}'`);
                await interaction.reply({
                    content: "This command is not implemented yet.",
                    flags: ['Ephemeral'],
                });
            }
        }
    }
    get name() {
        return this.data.name;
    }
    get description() {
        return this.data.description;
    }
}
exports.BaseCommand = BaseCommand;
//# sourceMappingURL=command.js.map