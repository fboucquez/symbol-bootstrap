import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ConfigService, Preset } from '../service';

export default class Config extends Command {
    static description = 'Command used to set up the configuration files and the nemesis block for the current network';

    static examples = [`$ symbol-bootstrap config -p bootstrap`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
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

        report: flags.boolean({
            description: 'It generates reStructuredText (.rst) reports describing the configuration of each node.',
            default: ConfigService.defaultParams.report,
        }),

        user: flags.string({
            char: 'u',
            description: `User used to run docker images when creating configuration files like certificates or nemesis block. "${BootstrapUtils.CURRENT_USER}" means the current user.`,
            default: BootstrapUtils.CURRENT_USER,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Config);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).config(flags);
    }
}
