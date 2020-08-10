import { Command, flags } from '@oclif/command';
import { ConfigService } from '../service/ConfigService';
import { ComposeService } from '../service/ComposeService';
import { BootstrapUtils } from '../service/BootstrapUtils';

export default class Compose extends Command {
    static description = 'It generates the docker-compose.yml file from the configured network.';

    static examples = [`$ symbol-bootstrap compose`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
        user: flags.string({
            char: 'u',
            description: 'User used to run the services in the docker-compose.yml file. "current" means the current user.',
            default: 'current',
        }),
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Compose);
        BootstrapUtils.showBanner();
        return new ComposeService({ ...flags, root: this.config.root }).run();
    }
}
