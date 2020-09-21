import { Command, flags } from '@oclif/command';
import { BootstrapUtils, ComposeService } from '../service';
import { BootstrapService } from '../service';

export default class Compose extends Command {
    static description = 'It generates the docker-compose.yml file from the configured network.';

    static examples = [`$ symbol-bootstrap compose`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ComposeService.defaultParams.target,
        }),
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
