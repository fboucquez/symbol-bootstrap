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
import { it } from 'mocha';
import { join } from 'path';
import { LoggerFactory, LogType } from '../../src';
import { ConfigPreset } from '../../src/model';
import { BootstrapUtils, ConfigLoader, Preset, RemoteNodeService } from '../../src/service';
const logger = LoggerFactory.getLogger(LogType.Silence);
describe('NetworkPresetUpgrade', () => {
    const patchNetworkPreset = async (preset: Preset): Promise<void> => {
        const root = './';
        const networkPresetLocation = `${root}/presets/${preset}/network.yml`;
        const sharedPresetLocation = join(root, 'presets', 'shared.yml');
        const sharedPreset = BootstrapUtils.loadYaml(sharedPresetLocation, false);
        const networkPreset = BootstrapUtils.loadYaml(networkPresetLocation, false);
        const configPreset: ConfigPreset = new ConfigLoader(logger).mergePresets(sharedPreset, networkPreset);
        const remoteNodeService = new RemoteNodeService(logger, configPreset, false);
        const urls = await remoteNodeService.getRestUrls();
        const epoch = await remoteNodeService.getBestFinalizationEpoch(urls);
        if (!epoch) {
            throw new Error('Epoch could not be resolved!!');
        }
        networkPreset.lastKnownNetworkEpoch = epoch;
        await BootstrapUtils.writeYaml(networkPresetLocation, networkPreset, undefined);
    };
    it('should patch testnet lastKnownNetworkEpoch', () => {
        return patchNetworkPreset(Preset.testnet);
    });
    it('should patch mainnet lastKnownNetworkEpoch', () => {
        return patchNetworkPreset(Preset.mainnet);
    });
});
