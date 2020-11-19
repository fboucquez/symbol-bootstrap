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

import { promises } from 'fs';
import { join } from 'path';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { ConfigPreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';

type NemgenParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class NemgenService {
    constructor(private readonly root: string, protected readonly params: NemgenParams) {}

    public async run(presetData: ConfigPreset): Promise<void> {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerToolsImage = presetData.symbolServerToolsImage;
        const target = this.params.target;

        if (!presetData.nodes || !presetData.nodes.length) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }

        const nemesisWorkingDir = BootstrapUtils.getTargetNemesisFolder(target, true);
        const nemesisSeedFolder = join(nemesisWorkingDir, `seed`, `${networkIdentifier}`, `0000`);
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(join(this.root, `config`, `hashes.dat`), join(nemesisSeedFolder, `hashes.dat`));
        const name = presetData.nodes[0].name;
        const userConfigWorkingDir = BootstrapUtils.getTargetNodesFolder(target, true, name, 'userconfig');

        BootstrapUtils.validateFolder(nemesisWorkingDir);
        BootstrapUtils.validateFolder(userConfigWorkingDir);

        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.nemgen`,
            '--resources=/userconfig',
            '--nemesisProperties=./userconfig/block-properties-file.properties',
        ];

        const binds = [`${userConfigWorkingDir}:/userconfig`, `${nemesisWorkingDir}:/nemesis`];

        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
            catapultAppFolder: presetData.catapultAppFolder,
            image: symbolServerToolsImage,
            userId: userId,
            workdir: '/nemesis',
            cmds: cmd,
            binds: binds,
        });

        if (stdout.indexOf('<error>') > -1) {
            logger.info(stdout);
            logger.error(stderr);
            throw new Error('Nemgen failed. Check the logs!');
        }
        logger.info('Nemgen executed!!!!');
    }
}
