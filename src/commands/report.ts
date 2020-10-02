import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ConfigService } from '../service';

export default class Clean extends Command {
    static description = 'it generates reStructuredText (.rst) reports describing the configuration of each node.';

    static examples = [`$ symbol-bootstrap report`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'The target folder where the configuration was generated',
            default: ConfigService.defaultParams.target,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).report(flags);
    }
}
