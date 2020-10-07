import { Command, flags } from '@oclif/command';
import { BootstrapUtils, ConfigService } from '../service';

export default class Clean extends Command {
    static description = 'It removes the target folder deleting the generated configuration and data';

    static examples = [`$ symbol-bootstrap clean`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        BootstrapUtils.showBanner();
        BootstrapUtils.deleteFolder(flags.target);
    }
}
