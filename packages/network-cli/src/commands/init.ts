/*
 * Copyright 2021 NEM
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
import { IOptionFlag } from '@oclif/command/lib/flags';
import { IBooleanFlag } from '@oclif/parser/lib/flags';
import { BootstrapUtils, LoggerFactory, LogType } from 'symbol-bootstrap-core';
import { NetworkUtils } from 'symbol-network-core';
import { InitService, NetworkCommandUtils } from '../utils';
export default class Init extends Command {
    static description = `This command is the first step configuring the node cluster for an existing an network or a new network.

It's prompt style wizard that asks a series of questions to start defining your nodes. The output of this command is a file containing a list of node types you want to create.

This is a "one time" command that will kick the network setup process. Please follow the instructions on the screen.

This commands creates the initial '${NetworkUtils.NETWORK_INPUT_FILE}' and '${NetworkUtils.NETWORK_PRESET_FILE}' files.
`;

    static examples = [`$ ${NetworkCommandUtils.CLI_TOOL} init`];
    static flags: {
        help: IBooleanFlag<void>;
        ready: IBooleanFlag<boolean>;
        showPrivateKeys: IBooleanFlag<boolean>;
        password: IOptionFlag<string | undefined>;
        noPassword: IBooleanFlag<boolean>;
    } = {
        help: NetworkCommandUtils.helpFlag,
        ready: flags.boolean({
            description: `if --read is provided, the won't ask for confirmations`,
            default: false,
        }),
        showPrivateKeys: flags.boolean({
            description: `if --showPrivateKeys is provided, private keys will be displayed`,
            default: false,
        }),
        password: NetworkCommandUtils.passwordFlag,
        noPassword: NetworkCommandUtils.noPasswordFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Init);
        NetworkCommandUtils.showBanner();
        const logger = LoggerFactory.getLogger(LogType.ConsoleLog);
        const workingDir = BootstrapUtils.defaultWorkingDir;
        return new InitService(logger, workingDir, flags as any).execute();
    }
}
