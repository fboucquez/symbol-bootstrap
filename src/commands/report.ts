import { Command } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';

export default class Clean extends Command {
    static description = 'it generates reStructuredText (.rst) reports describing the configuration of each node.';

    static examples = [`$ symbol-bootstrap report`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).report(flags);
    }
}
