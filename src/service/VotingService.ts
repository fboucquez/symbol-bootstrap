import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';

import { BootstrapUtils } from './BootstrapUtils';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { join } from 'path';

type VotingParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class VotingService {
    constructor(private readonly root: string, protected readonly params: VotingParams) {}

    private isVotingNode(nodeAccount: NodeAccount, nodePreset?: NodePreset[]): boolean {
        return (nodePreset || []).some((n) => n.name === nodeAccount.name && n.roles.split(',').some((r) => r === 'Voting'));
    }

    public async run(addresses: Addresses, presetData: ConfigPreset): Promise<void> {
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        await Promise.all(
            (addresses.nodes || []).map(async (n) => {
                if (this.isVotingNode(n, presetData.nodes)) {
                    const privateKeyTreeFileName = 'private_key_tree1.dat'
                    const dir = `${process.cwd()}/${this.params.target}`;
                    const votingKeysFolder = `${dir}/data/${n.name}/votingkeys`;
                    const cmd = [
                        'bash',
                        '-c',
                        `/usr/catapult/bin/catapult.tools.votingkey --secret ${n.voting.privateKey} --output /votingKeys/${privateKeyTreeFileName}`,
                    ];
                    
                    await BootstrapUtils.mkdir(votingKeysFolder);
                    await BootstrapUtils.deleteFile(join(votingKeysFolder, privateKeyTreeFileName));
                    const binds = [`${votingKeysFolder}:/votingKeys:rw`];

                    const stdout = await BootstrapUtils.runImageUsingExec(
                        symbolServerToolsImage,
                        await BootstrapUtils.getDockerUserGroup(),
                        cmd,
                        binds,
                    );

                    if (stdout.indexOf('<error> ') > -1) {
                        logger.info(stdout);
                        throw new Error('Voting key failed. Check the logs!');
                    }
                    logger.info(`Voting key executed for node ${n.name}!`);
                } else {
                    logger.info(`Non-voting node ${n.name}.`);
                }
            }),
        );
    }
}
