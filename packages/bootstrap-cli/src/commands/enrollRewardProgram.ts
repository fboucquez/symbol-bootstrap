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
import { BootstrapUtils, LoggerFactory, LogType } from 'symbol-bootstrap-core';
import { BootstrapCommandUtils, RewardProgramService } from '../service';

export default class EnrollRewardProgram extends Command {
    static description = `It enrols the nodes in the rewards program by announcing the enroll transaction to the registration address.  You can also use this command to update the program registration when you change the agent keys (changing the agent-ca-csr) or server host.

Currently, the only program that can be enrolled post-launch is 'SuperNode'.`;

    static examples = [
        `$ symbol-bootstrap enrollRewardProgram`,
        `$ symbol-bootstrap enrollRewardProgram --noPassword`,
        `$ symbol-bootstrap enrollRewardProgram --useKnownRestGateways`,
        `$ symbol-bootstrap enrollRewardProgram --password 1234 --url http://external-rest:3000`,
        `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap enrollRewardProgram --url http://external-rest:3000`,
    ];

    static flags = {
        help: BootstrapCommandUtils.helpFlag,
        target: BootstrapCommandUtils.targetFlag,
        ...BootstrapCommandUtils.announceFlags,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(EnrollRewardProgram);
        BootstrapCommandUtils.showBanner();
        const logger = LoggerFactory.getLogger(LogType.System, BootstrapUtils.defaultWorkingDir);
        flags.password = await BootstrapCommandUtils.resolvePassword(
            logger,
            flags.password,
            flags.noPassword,
            BootstrapCommandUtils.passwordPromptDefaultMessage,
            true,
        );
        await new RewardProgramService(logger, flags).enroll();
    }
}
