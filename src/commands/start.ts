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

import { Command } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';
import { CommandUtils } from '../service/CommandUtils';
import Clean from './clean';
import Compose from './compose';
import Config from './config';
import Run from './run';

export default class Start extends Command {
    static description = `Single command that aggregates config, compose and run in one line!

This command is typically run in ONLINE mode. It uses docker, docker compose, and images must be pulled from the internet. It's expected for a mainnet/testnet node to be connected to the internet.

However, if you require your setup to be OFFLINE, you can run \`config\`, and \`compose\` in your offline machine,
zip and copy the target folder into the online machine, and execute \`run\` or \`start\` there.
`;

    static examples = [
        `$ symbol-bootstrap start`,
        `$ symbol-bootstrap start -p bootstrap`,
        `$ symbol-bootstrap start -p testnet -a dual`,
        `$ symbol-bootstrap start -p testnet -a dual --password 1234`,
        `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap start -p testnet -a dual`,
    ];

    static flags = { ...Compose.flags, ...Run.flags, ...Clean.flags, ...Config.flags };

    public async run(): Promise<void> {
        const { flags } = this.parse(Start);
        BootstrapUtils.showBanner();
        flags.password = await CommandUtils.resolvePassword(
            flags.password,
            flags.noPassword,
            CommandUtils.passwordPromptDefaultMessage,
            true,
        );
        await new BootstrapService(this.config.root).start(flags);
    }
}
