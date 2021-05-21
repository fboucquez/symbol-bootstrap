/*
 * Copyright 2020 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { Account } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';
import { VotingUtils } from './VotingUtils';

type VotingParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class VotingService {
    constructor(protected readonly params: VotingParams) {}

    public async run(presetData: ConfigPreset, nodeAccount: NodeAccount, nodePreset: NodePreset | undefined): Promise<void> {
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        if (nodePreset?.voting) {
            const target = this.params.target;
            const votingKeysFolder = join(
                BootstrapUtils.getTargetNodesFolder(target, true, nodeAccount.name),
                presetData.votingKeysDirectory,
            );
            await BootstrapUtils.mkdir(votingKeysFolder);
            const votingUtils = new VotingUtils();
            await BootstrapUtils.deleteFile(join(votingKeysFolder, 'metadata.yml'));
            while (true) {
                const currentVotingFiles = votingUtils.loadVotingFiles(votingKeysFolder);
                const maxVotingKeyEndEpoch =
                    currentVotingFiles[currentVotingFiles.length - 1]?.endEpoch || presetData.lastKnownNetworkEpoch - 1;
                const votingKeyDesiredFutureLifetime = presetData.votingKeyDesiredFutureLifetime || presetData.votingKeyDesiredLifetime / 2;
                if (maxVotingKeyEndEpoch > presetData.lastKnownNetworkEpoch + votingKeyDesiredFutureLifetime) {
                    nodeAccount.voting = currentVotingFiles;
                    return;
                }
                const votingKeyStartEpoch = maxVotingKeyEndEpoch + 1;
                const votingKeyEndEpoch = maxVotingKeyEndEpoch + presetData.votingKeyDesiredLifetime;

                const votingAccount = Account.generateNewAccount(presetData.networkType);
                const votingPrivateKey = votingAccount.privateKey;
                const epochs = votingKeyEndEpoch - votingKeyStartEpoch + 1;
                logger.info(`Creating Voting key file of ${epochs} epochs for node ${nodeAccount.name}. This could take a while!`);
                const privateKeyTreeFileName = `private_key_tree${currentVotingFiles.length + 1}.dat`;
                if (presetData.useExperimentalNativeVotingKeyGeneration) {
                    logger.info('Voting file is created using the native typescript voting key file generator!');
                    const votingFile = await votingUtils.createVotingFile(votingPrivateKey, votingKeyStartEpoch, votingKeyEndEpoch);
                    writeFileSync(join(votingKeysFolder, privateKeyTreeFileName), votingFile);
                } else {
                    logger.info(`Voting file is created using docker and the default's catapult.tools.votingkey`);
                    const binds = [`${votingKeysFolder}:/votingKeys:rw`];
                    const cmd = [
                        `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
                        `--secret=${votingPrivateKey}`,
                        `--startEpoch=${votingKeyStartEpoch}`,
                        `--endEpoch=${votingKeyEndEpoch}`,
                        `--output=/votingKeys/${privateKeyTreeFileName}`,
                    ];
                    const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
                    const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
                        catapultAppFolder: presetData.catapultAppFolder,
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
                }
                logger.warn(`A new Voting File for the node ${nodeAccount.name} has been generated! `);
                logger.warn(
                    `Remember to send a Voting Key Link transaction from main ${nodeAccount.main.address} using the Voting Public Key: ${votingAccount.publicKey} with startEpoch: ${votingKeyStartEpoch} and endEpoch: ${votingKeyEndEpoch}`,
                );
                logger.warn('For linking, you can use symbol-bootstrap link command, the symbol cli, or the symbol desktop wallet. ');
            }
        } else {
            logger.info(`Non-voting node ${nodeAccount.name}.`);
        }
    }
}
