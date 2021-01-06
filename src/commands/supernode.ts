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
import { BootstrapService, BootstrapUtils } from '../service';
import { SupernodeService } from '../service/SupernodeService';

export default class Supernode extends Command {
    static description = `It registers the nodes in the supernode rewards program by announcing the enrol transaction to the registration address.`;

    static examples = [`$ symbol-bootstrap supernode`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
        url: flags.string({
            char: 'u',
            description: 'the network url',
            default: SupernodeService.defaultParams.url,
        }),
        maxFee: flags.integer({
            description: 'the max fee used when announcing (absolute)',
            default: SupernodeService.defaultParams.maxFee,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Supernode);
        BootstrapUtils.showBanner();
        return new BootstrapService(this.config.root).supernode(flags);
    }
}
