import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';

import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { join } from 'path';

type VotingParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class VotingService {
    constructor(protected readonly params: VotingParams) {}

    public async run(presetData: ConfigPreset, nodeAccount: NodeAccount, nodePreset: NodePreset | undefined): Promise<void> {
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        if (nodePreset?.voting && nodeAccount.voting) {
            const privateKeyTreeFileName = 'private_key_tree1.dat';
            const dir = `${process.cwd()}/${this.params.target}`;
            const votingKeysFolder = `${dir}/data/${nodeAccount.name}/votingkeys`;
            const cmd = [
                '/usr/catapult/bin/catapult.tools.votingkey',
                `--secret=${nodeAccount.voting.privateKey}`,
                `--dilution=${presetData.votingKeyDilution}`,
                `--startEpoch=${presetData.votingKeyStartEpoch}`,
                `--endEpoch=${presetData.votingKeyEndEpoch}`,
                `--output=/votingKeys/${privateKeyTreeFileName}`,
            ];

            await BootstrapUtils.mkdir(votingKeysFolder);
            await BootstrapUtils.deleteFile(join(votingKeysFolder, privateKeyTreeFileName));
            const binds = [`${votingKeysFolder}:/votingKeys:rw`];

            const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
            const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
                image: symbolServerToolsImage,
                userId: userId,
                cmds: cmd,
                binds: binds,
            });

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
