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
import { IBooleanFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { BootstrapUtils, LoggerFactory, LogType } from 'symbol-bootstrap-core';
import { NetworkService } from 'symbol-network-core';
import { NetworkCommandUtils } from '../utils';
export default class Link extends Command {
    static description = `It announces VRF and Voting Link transactions for all the nodes to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.`;

    static examples = [`$ symbol-network link`, `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-network link --unlink`];

    static flags: {
        help: IBooleanFlag<void>;
        unlink: IBooleanFlag<boolean>;
        ready: IBooleanFlag<boolean>;
        maxFee: IOptionFlag<number | undefined>;
        password: IOptionFlag<string | undefined>;
        noPassword: IBooleanFlag<boolean>;
        nodePassword: IOptionFlag<string | undefined>;
        noNodePassword: IBooleanFlag<boolean>;
    } = {
        help: NetworkCommandUtils.helpFlag,
        unlink: flags.boolean({
            description: 'Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer account from all the nodes',
            default: false,
        }),
        ready: flags.boolean({
            description: 'If --ready is provided, the command will not ask for confirmation when announcing transactions.',
            default: false,
        }),
        maxFee: flags.integer({
            description: 'the max fee used when announcing (absolute). The node min multiplier will be used if it is not provided.',
        }),
        password: NetworkCommandUtils.passwordFlag,
        noPassword: NetworkCommandUtils.noPasswordFlag,
        nodePassword: NetworkCommandUtils.nodePasswordFlag,
        noNodePassword: NetworkCommandUtils.noNodePasswordFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Link);
        const logger = LoggerFactory.getLogger(LogType.ConsoleLog);
        NetworkCommandUtils.showBanner();
        const workingDir = BootstrapUtils.defaultWorkingDir;
        const keyStore = await NetworkCommandUtils.createStore(flags, logger, true, workingDir);
        const service = new NetworkService(logger, workingDir);
        const nodePassword = await NetworkCommandUtils.resolveNodePassword(flags, logger);
        const params = {
            password: nodePassword,
            unlink: flags.unlink,
            maxFee: flags.maxFee,
        };
        await service.linkNodes(keyStore, params);
    }
}
