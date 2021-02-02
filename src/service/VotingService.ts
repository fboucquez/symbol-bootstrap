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
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';

type VotingParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class VotingService {
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
            const cmd = [
                `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
                `--secret=${nodeAccount.voting.privateKey}`,
                `--startEpoch=${presetData.votingKeyStartEpoch}`,
                `--endEpoch=${presetData.votingKeyEndEpoch}`,
                `--output=/votingKeys/${privateKeyTreeFileName}`,
            ];

            await BootstrapUtils.mkdir(votingKeysFolder);
            await BootstrapUtils.deleteFile(join(votingKeysFolder, privateKeyTreeFileName));
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
            logger.info(`Voting key executed for node ${nodeAccount.name}!`);
        } else {
            logger.info(`Non-voting node ${nodeAccount.name}.`);
        }
    }
}
