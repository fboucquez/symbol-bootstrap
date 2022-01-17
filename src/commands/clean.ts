/*
 * Copyright 2022 Fernando Boucquez
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
import { LoggerFactory, System } from '../logger';
import { BootstrapUtils, CommandUtils } from '../service';

export default class Clean extends Command {
    static description = 'It removes the target folder deleting the generated configuration and data';

    static examples = [`$ symbol-bootstrap clean`];

    static flags = {
        help: CommandUtils.helpFlag,
        target: CommandUtils.targetFlag,
        logger: CommandUtils.getLoggerFlag(...System),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        CommandUtils.showBanner();
        const logger = LoggerFactory.getLogger(flags.logger);
        BootstrapUtils.deleteFolder(logger, flags.target);
    }
}
