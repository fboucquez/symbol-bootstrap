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

import { Command, flags } from '@oclif/command';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { BootstrapUtils, CommandUtils, ConfigLoader, CryptoUtils, RemoteNodeService, VotingService } from '../service';
const logger: Logger = LoggerFactory.getLogger(LogType.System);

export default class UpgradeVotingKeys extends Command {
    static description = `It upgrades the voting keys and files when required.

Voting file upgrade:
- If the node's current voting file has an end epoch close to the current epoch ("close to expiring") this command creates a new 'private_key_treeX.dat' that continues the current file.
- "Close to expiring" happens when the epoch is in the upper half of the voting file. If the file's epoch length is 720, close to expiring will be 360+.
- The current finalization epoch that defines if the file is close to expiration can be passed as parameter. Otherwise, bootstrap will try to resolve it from the network.

When a new voting file is created, bootstrap will advise running the link command again.

`;

    static examples = [`$ symbol-bootstrap upgradeVotingKeys`];

    static flags = {
        help: CommandUtils.helpFlag,
        target: CommandUtils.targetFlag,
        user: flags.string({
            char: 'u',
            description: `User used to run docker images when creating the the voting key files. "${BootstrapUtils.CURRENT_USER}" means the current user.`,
            default: BootstrapUtils.CURRENT_USER,
        }),
        finalizationEpoch: flags.integer({
            description: `The network's finalization epoch. It can be retrieved from the /chain/info rest endpoint. If not provided, the bootstrap known epoch is used.`,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(UpgradeVotingKeys);
        BootstrapUtils.showBanner();
        const password = false;
        const target = flags.target;
        const configLoader = new ConfigLoader();
        const addressesLocation = configLoader.getGeneratedAddressLocation(target);
        const presetData = configLoader.loadExistingPresetData(target, password);
        const addresses = configLoader.loadExistingAddresses(target, password);
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);

        const finalizationEpoch = flags.finalizationEpoch || (await new RemoteNodeService().resolveCurrentFinalizationEpoch(presetData));

        const votingKeyUpgrade = (
            await Promise.all(
                (presetData.nodes || []).map((nodePreset, index) => {
                    const nodeAccount = addresses.nodes?.[index];
                    if (!nodeAccount) {
                        throw new Error(`There is not node in addresses at index ${index}`);
                    }
                    return new VotingService({
                        target,
                        user: flags.user,
                    }).run(presetData, nodeAccount, nodePreset, finalizationEpoch, true);
                }),
            )
        ).find((f) => f);
        if (votingKeyUpgrade) {
            await BootstrapUtils.writeYaml(
                addressesLocation,
                CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode),
                undefined,
            );
            logger.warn('Bootstrap has created new voting file(s). Review the logs!');
            logger.warn('');
        } else {
            logger.info('');
            logger.info('Voting files are up-to-date. There is nothing to upgrade');
            logger.info('');
        }
    }
}