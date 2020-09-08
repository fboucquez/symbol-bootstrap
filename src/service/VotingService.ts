import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';

import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { join } from 'path';

type VotingParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetConfigFolder = BootstrapUtils.targetConfigFolder;

export class VotingService {
    constructor(protected readonly params: VotingParams) {}

    private isVotingNode(n?: NodePreset): boolean {
        return n!.roles.split(',').some((r) => r.trim() === 'Voting');
    }

    public async run(presetData: ConfigPreset, nodeAccount: NodeAccount, nodePreset: NodePreset | undefined): Promise<void> {
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        if (this.isVotingNode(nodePreset)) {
            const privateKeyTreeFileName = 'private_key_tree1.dat';
            const dir = `${process.cwd()}/${this.params.target}`;
            const dataFolder = join(dir, targetConfigFolder, nodeAccount.name, 'data');
            const votingKeysFolder = join(dataFolder, `votingkeys`);
            const cmd = [
                'bash',
                '-c',
                `/usr/catapult/bin/catapult.tools.votingkey --secret ${nodeAccount.voting.privateKey} --output /votingKeys/${privateKeyTreeFileName}`,
            ];

            await BootstrapUtils.mkdir(votingKeysFolder);
            await BootstrapUtils.deleteFile(join(votingKeysFolder, privateKeyTreeFileName));
            const binds = [`${votingKeysFolder}:/votingKeys:rw`];

            const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
            const { stdout, stderr } = await BootstrapUtils.runImageUsingExec(symbolServerToolsImage, userId, cmd, binds);

            if (stdout.indexOf('<error> ') > -1) {
                logger.info(stdout);
                logger.error(stderr);
                throw new Error('Voting key failed. Check the logs!');
            }
            logger.info(`Voting key executed for node ${nodeAccount.name}!`);
        } else {
            logger.info(`Non-voting node ${nodeAccount.name}.`);
        }
    }
}
