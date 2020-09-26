import { Command, flags } from '@oclif/command';
import { BootstrapUtils, ConfigService, RunService } from '../service';

export default class Stop extends Command {
    static description =
        'It stops the docker-compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker-compose down` bash call.';
    static examples = [`$ symbol-bootstrap stop`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Stop);
        BootstrapUtils.showBanner();
        return new RunService(flags).stop();
    }
}
