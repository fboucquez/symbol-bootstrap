import { Command } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';

export default class ResetData extends Command {
    static description = 'It removes the data keeping the generated configuration, certificates, keys and block 1.';

    static examples = [`$ symbol-bootstrap resetData`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(ResetData);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).resetData(flags);
    }
}
