import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ConfigService } from '../service';

export default class ResetData extends Command {
    static description = 'It removes the data keeping the generated configuration, certificates, keys and block 1.';

    static examples = [`$ symbol-bootstrap resetData`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(ResetData);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).resetData(flags);
    }
}
