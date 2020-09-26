import { Command, flags } from '@oclif/command';
import { BootstrapUtils, ConfigService, RunService } from '../service';

export default class Run extends Command {
    static description =
        'It boots the network via docker using the generated `docker-compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker-compose up` bash call.';

    static examples = [`$ symbol-bootstrap run`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
        detached: flags.boolean({
            char: 'd',
            description:
                'If provided, docker-compose will run with -d (--detached) and this command will wait unit server is running before returning',
        }),
        service: flags.string({
            char: 's',
            description: 'To start a particular docker compose service by name, example rest-gateway, db, node-peer-0',
        }),

        build: flags.boolean({
            char: 'b',
            description: 'If provided, docker-compose will run with -b (--build)',
        }),
        timeout: flags.integer({
            char: 't',
            description: 'If running in detached mode, how long before timing out (in MS)',
            default: RunService.defaultParams.timeout,
        }),
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Run);
        BootstrapUtils.showBanner();
        return new RunService(flags).run();
    }
}
