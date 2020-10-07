import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ConfigService } from '../service';

export default class HealthCheck extends Command {
    static description = 'It checks if the services created with docker compose are up and running.';

    static examples = [`$ symbol-bootstrap healthCheck`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(HealthCheck);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).healthCheck(flags);
    }
}
