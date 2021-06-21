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
import { BootstrapUtils, LoggerFactory, LogType, RunService } from 'symbol-bootstrap-core';
import { BootstrapCommandUtils } from '../service';

export default class Stop extends Command {
    static description =
        'It stops the docker-compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker-compose down` bash call.';
    static examples = [`$ symbol-bootstrap stop`];

    static flags = {
        help: BootstrapCommandUtils.helpFlag,
        target: BootstrapCommandUtils.targetFlag,
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Stop);
        BootstrapCommandUtils.showBanner();
        const workingDir = BootstrapUtils.defaultWorkingDir;
        const logger = LoggerFactory.getLogger(LogType.System, workingDir);
        return new RunService(logger, flags).stop();
    }
}
