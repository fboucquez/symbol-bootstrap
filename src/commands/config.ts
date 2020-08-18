import { Command, flags } from '@oclif/command';
import { BootstrapUtils, ConfigService, Preset } from '../service';
import { BootstrapService } from '../service/BootstrapService';

export default class Config extends Command {
    static description = 'Command used to set up the configuration files and the nemesis block for the current network';

    static examples = [`$ symbol-bootstrap config -p bootstrap`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        preset: flags.enum({
            char: 'p',
            description: 'the network preset',
            options: Object.keys(Preset).map((v) => v as Preset),
            default: ConfigService.defaultParams.preset,
        }),
        assembly: flags.string({
            char: 'a',
            description: 'An optional assembly type, example "dual" for testnet',
        }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
        customPreset: flags.string({
            char: 'c',
            description: 'External preset file. Values in this file will override the provided presets (optional)',
            required: false,
        }),
        reset: flags.boolean({
            char: 'r',
            description: 'It resets the configuration generating a new one',
            default: ConfigService.defaultParams.reset,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Config);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).config(flags);
    }
}
