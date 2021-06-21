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
import { NetworkService, NetworkUtils } from 'symbol-network-core';
import { NetworkCommandUtils } from '../utils';
export default class ConfigureNodes extends Command {
    static description = `This is the last step of the node cluster setup that generates and updates each node's configuration.

Each node defined in the "${NetworkUtils.NETWORK_FILE}" file will have it's own symbol-bootstrap "target" folder. Each folder can be then be deployed into the final node boxes like in AWS.

This command can be executed multiple times if you need to update or upgrade your nodes. Then you can redeploy the configuration in the final the node boxes.
`;

    static examples = [`$ ${NetworkCommandUtils.CLI_TOOL} configureNodes`];

    static flags: {
        help: IBooleanFlag<void>;
        password: IOptionFlag<string | undefined>;
        noPassword: IBooleanFlag<boolean>;
        nodePassword: IOptionFlag<string | undefined>;
        noNodePassword: IBooleanFlag<boolean>;
        offline: IBooleanFlag<boolean>;
    } = {
        help: NetworkCommandUtils.helpFlag,
        password: NetworkCommandUtils.passwordFlag,
        noPassword: NetworkCommandUtils.noPasswordFlag,
        nodePassword: NetworkCommandUtils.nodePasswordFlag,
        noNodePassword: NetworkCommandUtils.noNodePasswordFlag,
        offline: flags.boolean({
            description:
                'Use --offline If you are creating the nodes for the first time and there is information to be updated from the current running network.',
            default: false,
        }),
    };

    public async run(): Promise<void> {
        NetworkCommandUtils.showBanner();
        const logger = LoggerFactory.getLogger(LogType.Console);
        const { flags } = this.parse(ConfigureNodes);
        const workingDir = BootstrapUtils.defaultWorkingDir;
        const keyStore = await NetworkCommandUtils.createStore(flags, logger, true, workingDir);
        const nodePassword = await NetworkCommandUtils.resolveNodePassword(flags, logger);
        await new NetworkService(logger, workingDir).updateNodes(keyStore, { nodePassword, offline: flags.offline });
    }
}
