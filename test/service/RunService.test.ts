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

import { expect } from 'chai';
import { existsSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { ConfigService, FileSystemService, LoggerFactory, LogType, Utils } from '../../src';
import { BootstrapService, Preset, RunService, StartParams } from '../../src/service';
const logger = LoggerFactory.getLogger(LogType.Silent);
const fileSystemService = new FileSystemService(logger);
describe('RunService', () => {
    const target = 'target/tests/BootstrapService.standard';

    it('healthCheck', async () => {
        const bootstrapService = new BootstrapService(logger);
        const config: StartParams = {
            ...ConfigService.defaultParams,
            report: false,
            upgrade: false,
            preset: Preset.bootstrap,
            reset: false,
            target,
            detached: true,
            build: false,
            user: 'current',
            timeout: 1200,
        };

        await bootstrapService.config(config);

        await bootstrapService.compose(config);

        const service = new RunService(logger, { ...config });
        try {
            await service.healthCheck(500);
        } catch (e) {
            expect(Utils.getMessage(e)).to.equal('Network did NOT start!!!');
            return;
        }
        throw new Error('This should fail!');
    });

    it('resetData', async () => {
        const bootstrapService = new BootstrapService(logger);
        const config: StartParams = {
            ...ConfigService.defaultParams,
            report: false,
            upgrade: false,
            preset: Preset.bootstrap,
            reset: false,
            target,
            detached: true,
            build: false,
            user: 'current',
            timeout: 1200,
        };

        const configResult = await bootstrapService.config(config);
        await bootstrapService.compose(config);

        const nodeDataFolder = fileSystemService.getTargetNodesFolder(target, false, configResult.presetData.nodes![0].name, 'data');
        expect(existsSync(nodeDataFolder)).eq(true);
        fileSystemService.deleteFolder(nodeDataFolder);
        expect(existsSync(nodeDataFolder)).eq(false);
        const service = new RunService(logger, { ...config });
        await service.resetData();
        expect(existsSync(join(nodeDataFolder, '00000', '00001.dat'))).eq(false);
    });
});
