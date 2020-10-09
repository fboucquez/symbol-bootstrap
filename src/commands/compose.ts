import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ComposeService } from '../service';

export default class Compose extends Command {
    static description = 'It generates the `docker-compose.yml` file from the configured network.';

    static examples = [`$ symbol-bootstrap compose`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
        reset: flags.boolean({
            char: 'r',
            description: 'It resets the configuration generating a new one',
            default: ComposeService.defaultParams.reset,
        }),
        user: flags.string({
            char: 'u',
            description: `User used to run the services in the docker-compose.yml file. "${BootstrapUtils.CURRENT_USER}" means the current user.`,
            default: 'current',
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Compose);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).compose(flags);
    }
}
