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

import { join } from 'path';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { ConfigAccount, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';

type VotingParams = ConfigParams;

export interface VotingMetadata {
    readonly votingKeyStartEpoch: number;
    readonly votingKeyEndEpoch: number;
    readonly votingPublicKey: string;
    readonly version: number;
}

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class VotingService {
    private static readonly METADATA_VERSION = 1;

    constructor(protected readonly params: VotingParams) {}

    public async run(presetData: ConfigPreset, nodeAccount: NodeAccount, nodePreset: NodePreset | undefined): Promise<void> {
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        if (nodePreset?.voting && nodeAccount.voting) {
            const privateKeyTreeFileName = 'private_key_tree1.dat';
            const target = this.params.target;
            const votingKeysFolder = join(
                BootstrapUtils.getTargetNodesFolder(target, true, nodeAccount.name),
                presetData.votingKeysDirectory,
            );
            const metadataFile = join(votingKeysFolder, 'metadata.yml');
            if (!(await this.shouldGenerateVoting(presetData, metadataFile, nodeAccount.voting))) {
                logger.info(`Voting File for node ${nodePreset.name} has been previously generated. Reusing...`);
                return;
            }
            const votingPrivateKey = nodeAccount?.voting.privateKey;

            if (!votingPrivateKey) {
                throw new Error(
                    'Voting key should have been previously generated!!! You need to reset your target folder. Please run --reset using your original custom preset.',
                );
            }

            const cmd = [
                `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
                `--secret=${votingPrivateKey}`,
                `--startEpoch=${presetData.votingKeyStartEpoch}`,
                `--endEpoch=${presetData.votingKeyEndEpoch}`,
                `--output=/votingKeys/${privateKeyTreeFileName}`,
            ];
            await BootstrapUtils.deleteFolder(votingKeysFolder);
            await BootstrapUtils.mkdir(votingKeysFolder);
            const binds = [`${votingKeysFolder}:/votingKeys:rw`];

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
            logger.warn(`A new Voting File for the node ${nodeAccount.name} has been regenerated! `);
            logger.warn(
                `Remember to send a Voting Key Link transaction from main ${nodeAccount.main.address} using the Voting Public Key ${nodeAccount.voting.publicKey} with startEpoch ${presetData.votingKeyStartEpoch} and endEpoch: ${presetData.votingKeyEndEpoch}`,
            );
            logger.warn('For linking, you can use symbol-bootstrap link command, the symbol cli, or the symbol desktop wallet. ');
            logger.warn('The voting public key is stored in the target`s addresses.yml for reference');

            const metadata: VotingMetadata = {
                votingKeyStartEpoch: presetData.votingKeyStartEpoch,
                votingKeyEndEpoch: presetData.votingKeyEndEpoch,
                version: VotingService.METADATA_VERSION,
                votingPublicKey: nodeAccount.voting.publicKey,
            };
            await BootstrapUtils.writeYaml(metadataFile, metadata, undefined);
        } else {
            logger.info(`Non-voting node ${nodeAccount.name}.`);
        }
    }

    private async shouldGenerateVoting(presetData: ConfigPreset, metadataFile: string, votingAccount: ConfigAccount): Promise<boolean> {
        try {
            const metadata = BootstrapUtils.loadYaml(metadataFile, false) as VotingMetadata;
            return (
                metadata.votingPublicKey !== votingAccount.publicKey ||
                metadata.version !== VotingService.METADATA_VERSION ||
                metadata.votingKeyStartEpoch !== presetData.votingKeyStartEpoch ||
                metadata.votingKeyEndEpoch !== presetData.votingKeyEndEpoch
            );
        } catch (e) {
            return true;
        }
    }
}
