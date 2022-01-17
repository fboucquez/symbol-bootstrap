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

import { promises } from 'fs';
import { join } from 'path';
import { Logger } from '../logger';
import { ConfigPreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';
import { RuntimeService } from './RuntimeService';

type NemgenParams = ConfigParams;

export class NemgenService {
    private readonly runtimeService: RuntimeService;
    constructor(private readonly logger: Logger, protected readonly params: NemgenParams) {
        this.runtimeService = new RuntimeService(logger);
    }

    public async run(presetData: ConfigPreset): Promise<void> {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerImage = presetData.symbolServerImage;
        const target = this.params.target;

        if (!presetData.nodes || !presetData.nodes.length) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }

        const nemesisWorkingDir = BootstrapUtils.getTargetNemesisFolder(target, true);
        const nemesisSeedFolder = join(nemesisWorkingDir, `seed`, networkIdentifier, `0000`);
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(join(BootstrapUtils.ROOT_FOLDER, `config`, `hashes.dat`), join(nemesisSeedFolder, `hashes.dat`));
        const name = presetData.nodes[0].name;
        const serverConfigWorkingDir = BootstrapUtils.getTargetNodesFolder(target, true, name, 'server-config');

        BootstrapUtils.validateFolder(nemesisWorkingDir);
        BootstrapUtils.validateFolder(serverConfigWorkingDir);

        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.nemgen`,
            '--resources=/server-config',
            '--nemesisProperties=./server-config/block-properties-file.properties',
            '--useTemporaryCacheDatabase',
        ];

        const binds = [`${serverConfigWorkingDir}:/server-config`, `${nemesisWorkingDir}:/nemesis`];

        const userId = await this.runtimeService.resolveDockerUserFromParam(this.params.user);
        let stdout: string;
        let stderr: string;
        let message: string | undefined;
        let failed: boolean;
        try {
            ({ stdout, stderr } = await this.runtimeService.runImageUsingExec({
                catapultAppFolder: presetData.catapultAppFolder,
                image: symbolServerImage,
                userId: userId,
                workdir: '/nemesis',
                cmds: cmd,
                binds: binds,
            }));
            failed = stdout.indexOf('<error>') > -1;
        } catch (e) {
            failed = true;
            ({ stdout, stderr, message } = e);
        }
        if (failed) {
            if (message) this.logger.error(message);
            if (stdout) this.logger.info(stdout);
            if (stderr) this.logger.error(stderr);
            throw new Error('Nemgen failed. Check the logs!');
        }
        BootstrapUtils.deleteFolder(this.logger, join(nemesisWorkingDir, `seed`, networkIdentifier));
        this.logger.info('Nemgen executed!!!!');
    }
}
