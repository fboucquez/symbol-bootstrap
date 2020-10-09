import { Command } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';

export default class HealthCheck extends Command {
    static description = `It checks if the services created with docker compose are up and running:
- if the docker containers are running.
- if the services' exposed ports are listening.
- if the rest gateways' /node/health are OK.

The health check process handles 'repeat' and custom 'openPort' services.
    `;

    static examples = [`$ symbol-bootstrap healthCheck`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(HealthCheck);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).healthCheck(flags);
    }
}
