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

import { join } from 'path';
import { AnnounceService, ConfigLoader, LinkTransactionGenericFactory, Logger, RemoteNodeService } from 'symbol-bootstrap-core';
import { KeyStore, NetworkUtils } from '.';
import { NetworkAccountResolver } from './NetworkAccountResolver';

export interface LinkNodesParams {
    password: string | undefined;
    unlink: boolean;
    maxFee: number | undefined;
}

export class NetworkLinkService {
    constructor(private readonly logger: Logger, private readonly workingDir: string, private readonly keyStore: KeyStore) {}

    public async linkNodes({ password, unlink, maxFee }: LinkNodesParams): Promise<void> {
        const configLoader = new ConfigLoader(this.logger);
        const input = await NetworkUtils.loadNetwork(this.workingDir);
        const networkPreset = ConfigLoader.loadNetworkPreset(input.preset, this.workingDir);
        if (!networkPreset.knownRestGateways?.length) {
            throw new Error('Rest gateways could not be resolved!!!');
        }
        const repositoryInfo = await new RemoteNodeService(this.logger).getBestRepositoryInfo(networkPreset.knownRestGateways);

        for (const node of input.nodes) {
            const service = new AnnounceService(this.logger, new NetworkAccountResolver(this.logger, node, this.keyStore));
            const nodeFolder = join('nodes', `node-${NetworkUtils.zeroPad(node.number, 3)}`);
            this.logger.info('');
            this.logger.info(`Linking node ${node.number} ${node.friendlyName}`);
            this.logger.info('');
            const bootstrapTargetFolder = join(nodeFolder, 'target');
            const targetPreset = configLoader.loadExistingPresetData(bootstrapTargetFolder, password);
            const addresses = configLoader.loadExistingAddresses(bootstrapTargetFolder, password);
            this.logger.info(`${unlink ? 'Unlinking' : 'Linking'} nodes`);
            const presetData = configLoader.mergePresets(targetPreset, node.customPreset);
            const transactionFactory = new LinkTransactionGenericFactory(this.logger, async () => true, unlink);
            await service.announce(repositoryInfo.repositoryFactory, maxFee, true, presetData, addresses, transactionFactory);
            this.logger.info('');
            this.logger.info('-----');
        }
    }
}
