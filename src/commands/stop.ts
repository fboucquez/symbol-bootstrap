import { Command, flags } from '@oclif/command';
import { ConfigService } from '../service/ConfigService';
import { RunService } from '../service/RunService';
import { BootstrapUtils } from '../service/BootstrapUtils';

export default class Stop extends Command {
    static description = `It stops the docker-compose network if it's running (example, when symbol-bootstrap start --daemon).`;

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
        return new RunService({ ...flags, root: this.config.root }).stop();
    }
}
