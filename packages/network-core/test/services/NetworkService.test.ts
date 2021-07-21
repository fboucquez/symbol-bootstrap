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

import { expect } from 'chai';
import { existsSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { BootstrapUtils, LoggerFactory, LogType } from 'symbol-bootstrap-core';
import { LocalFileKeyStore, NetworkService, NetworkUtils } from '../../src';

const testFolder = 'target';
const logger = LoggerFactory.getLogger(LogType.ConsoleLog);

describe('NetworkSetup', () => {
    it('network 1', async function () {
        const testName = 'network1';
        const fromTestFolder = join('test', 'networkExamples', testName);
        const fromExpectedFolder = join('test', 'networkExamples', `${testName}-expected`);
        const targetFolder = join(testFolder, testName);
        await BootstrapUtils.deleteFolder(logger, targetFolder);
        expect(existsSync(fromTestFolder)).eq(true);
        await BootstrapUtils.copyDir(fromTestFolder, targetFolder);
        const service = new NetworkService(logger, targetFolder);
        const keyStore = new LocalFileKeyStore(undefined, true, targetFolder);
        const generatedNetworkFile = await service.expandNodes(keyStore);
        await service.generateNemesis(keyStore, { regenerate: false, composeUser: '1000:1000' });
        await service.updateNodes(keyStore, { offline: true, nodePassword: undefined, composeUser: '1000:1000' });

        const generatedCustomNetworkPreset = await BootstrapUtils.loadYaml(join(targetFolder, NetworkUtils.NETWORK_PRESET_FILE), undefined);

        const expectedNetworkFile = await BootstrapUtils.loadYaml(join(fromExpectedFolder, NetworkUtils.NETWORK_FILE), undefined);
        expect(generatedNetworkFile).deep.eq(expectedNetworkFile);
        const expectedCustomNetworkPreset = await BootstrapUtils.loadYaml(
            join(fromExpectedFolder, NetworkUtils.NETWORK_PRESET_FILE),
            undefined,
        );
        expect(generatedCustomNetworkPreset).deep.eq(expectedCustomNetworkPreset);

        const generatedKeyStoreFile = await BootstrapUtils.loadYaml(join(targetFolder, NetworkUtils.KEY_STORE_FILE), undefined);
        const expectedKeyStoreFile = await BootstrapUtils.loadYaml(join(fromExpectedFolder, NetworkUtils.KEY_STORE_FILE), undefined);
        expect(generatedKeyStoreFile).deep.eq(expectedKeyStoreFile);
    });
});
