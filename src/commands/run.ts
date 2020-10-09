import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, RunService } from '../service';
import HealthCheck from './healthCheck';

export default class Run extends Command {
    static description =
        'It boots the network via docker using the generated `docker-compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker-compose up` bash call.';

    static examples = [`$ symbol-bootstrap run`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
        detached: flags.boolean({
            char: 'd',
            description:
                'If provided, docker-compose will run with -d (--detached) and this command will wait unit server is running before returning',
        }),

        healthCheck: flags.boolean({
            description: HealthCheck.description,
        }),

        resetData: flags.boolean({
            description: 'It reset the database and node data but keeps the generated configuration, keys, voting tree files and block 1',
        }),

        args: flags.string({
            char: 'a',
            multiple: true,
            description: 'Add extra arguments to the docker-compose up command. Check out https://docs.docker.com/compose/reference/up.',
        }),

        build: flags.boolean({
            char: 'b',
            description: 'If provided, docker-compose will run with -b (--build)',
        }),

        timeout: flags.integer({
            description: 'If running in detached mode, how long before timing out (in milliseconds)',
            default: RunService.defaultParams.timeout,
        }),
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Run);
        BootstrapUtils.showBanner();
        return new BootstrapService(this.config.root).run(flags);
    }
}
