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
import { BootstrapService, BootstrapUtils } from '../service';

export default class Backup extends Command {
    static description = `The command backs up the Mongo and RocksDb data folder into a Zip file that can then be used by the \`--backupSync\` feature. Bootstrap compose services must be stopped before calling this command.

Note: This command is designed for NGL to be used when running public main or public test networks. It's not backing up any node specific information.`;

    static examples = [`$ symbol-bootstrap backup`];

    static flags = {
        help: BootstrapUtils.helpFlag,
        target: BootstrapUtils.targetFlag,
        nodeName: flags.string({
            description: `The dual/api node name to be used to backup the data. If not provided, the first configured api/dual node would be used.`,
        }),
        fullBackup: BootstrapUtils.fullBackupFlag,
        destinationFile: flags.string({
            description: `The file location where the backup zip file will be created. Default destination is target/backup.zip.`,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Backup);
        BootstrapUtils.showBanner();
        await new BootstrapService(this.config.root).backup(flags);
    }
}
