import { Command } from '@oclif/command';
import { BootstrapUtils, RunService } from '../service';

export default class Stop extends Command {
    static description =
        'It stops the docker-compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker-compose down` bash call.';
    static examples = [`$ symbol-bootstrap stop`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Stop);
        BootstrapUtils.showBanner();
        return new RunService(flags).stop();
    }
}
