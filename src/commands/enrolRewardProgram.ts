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
import { AnnounceService } from '../service/AnnounceService';
import { CommandUtils } from '../service/CommandUtils';

export default class EnrolRewardProgram extends Command {
    static description = `It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address.  You can also use this command to update the program registration when you change the node public key or server host.

Currently, the only program that can be enrolled post-launch is 'SuperNode'.`;

    static examples = [
        `$ symbol-bootstrap enrolRewardProgram`,
        `$ symbol-bootstrap enrolRewardProgram --noPassword`,
        `$ symbol-bootstrap enrolRewardProgram --useKnownRestGateways`,
        `$ symbol-bootstrap enrolRewardProgram --password 1234 --url http://external-rest:3000`,
        `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap enrolRewardProgram --url http://external-rest:3000`,
    ];

    static flags = {
        help: CommandUtils.helpFlag,
        target: CommandUtils.targetFlag,
        ...AnnounceService.flags,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(EnrolRewardProgram);
        BootstrapUtils.showBanner();
        flags.password = await CommandUtils.resolvePassword(
            flags.password,
            flags.noPassword,
            CommandUtils.passwordPromptDefaultMessage,
            true,
        );
        return new BootstrapService(this.config.root).enrolRewardProgram(flags);
    }
}
