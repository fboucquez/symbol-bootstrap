import { Command } from '@oclif/command';
import { BootstrapUtils } from '../service';

export default class Clean extends Command {
    static description = 'It removes the target folder deleting the generated configuration and data';

    static examples = [`$ symbol-bootstrap clean`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        BootstrapUtils.showBanner();
        BootstrapUtils.deleteFolder(flags.target);
    }
}
