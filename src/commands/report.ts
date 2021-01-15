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

export default class Clean extends Command {
    static description = 'it generates reStructuredText (.rst) reports describing the configuration of each node.';

    static examples = [`$ symbol-bootstrap report`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
        password: BootstrapUtils.passwordFlag,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Clean);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).report(flags);
    }
}
