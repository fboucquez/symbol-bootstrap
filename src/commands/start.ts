import { Command } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';
import Config from './config';
import Compose from './compose';
import Run from './run';
import Clean from './clean';

export default class Start extends Command {
    static description = 'Single command that aggregates config, compose and run in one line!';

    static examples = [`$ symbol-bootstrap start`, `$ symbol-bootstrap start -p bootstrap`, `$ symbol-bootstrap start -p testnet -a dual`];

    static flags = { ...Compose.flags, ...Run.flags, ...Clean.flags, ...Config.flags };

    public async run(): Promise<void> {
        const { flags } = this.parse(Start);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).start(flags);
    }
}
