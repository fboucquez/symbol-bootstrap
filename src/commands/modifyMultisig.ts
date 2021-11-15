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
import { AnnounceService } from '../service/AnnounceService';
import { CommandUtils } from '../service/CommandUtils';

export default class ModifyMultisig extends Command {
    static description = `Create or modify a multisig account`;

    static examples = [
        `$ symbol-bootstrap modifyMultisig`,
        `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap modifyMultisig --useKnownRestGateways`,
    ];

    static flags = {
        help: CommandUtils.helpFlag,
        target: CommandUtils.targetFlag,
        minRemovalDelta: flags.integer({
            description:
                'Delta of signatures needed to remove a cosignatory. ' +
                '0 means no change, a positive(+) number means increment and a negative(-) number means decrement to the actual value.',
            char: 'r',
        }),
        minApprovalDelta: flags.integer({
            description:
                'Delta of signatures needed to approve a transaction. ' +
                '0 means no change, a positive(+) number means increment and a negative(-) number means decrement to the actual value.',
            char: 'a',
        }),
        addressAdditions: flags.string({
            description: 'Cosignatory accounts addresses to be added (separated by a comma).',
            char: 'A',
        }),
        addressDeletions: flags.string({
            description: 'Cosignatory accounts addresses to be removed (separated by a comma).',
            char: 'D',
        }),
        ...AnnounceService.flags,
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(ModifyMultisig);
        BootstrapUtils.showBanner();
        flags.password = await CommandUtils.resolvePassword(
            flags.password,
            flags.noPassword,
            CommandUtils.passwordPromptDefaultMessage,
            true,
        );
        return new BootstrapService().modifyMultisig(flags);
    }
}
