import { Command } from '@oclif/command';
import { ConfigService } from '../service/ConfigService';
import Config from './config';
import { ComposeService } from '../service/ComposeService';
import { RunService } from '../service/RunService';
import { BootstrapUtils } from '../service/BootstrapUtils';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import Compose from './compose';
import Run from './run';
import Clean from './clean';

const logger: Logger = LoggerFactory.getLogger(LogType.System);
export default class Start extends Command {
    static description = 'Single command that aggregates config, compose and run in one liner! ';

    static examples = [`$ symbol-bootstrap start`, `$ symbol-bootstrap start -p bootstrap`, `$ symbol-bootstrap start -p testnet -a dual`];

    static flags = { ...Compose.flags, ...Run.flags, ...Clean.flags, ...Config.flags };

    public async run(): Promise<void> {
        const { flags } = this.parse(Start);
        BootstrapUtils.showBanner();
        if (flags.reset) {
            logger.info(`deleting folder ${flags.target}...`);
            BootstrapUtils.deleteFolderRecursive(flags.target);
        }
        await new ConfigService({ ...flags, root: this.config.root }).run();
        await new ComposeService({ ...flags, root: this.config.root }).run();
        await new RunService({ ...flags, root: this.config.root }).run();
    }
}
