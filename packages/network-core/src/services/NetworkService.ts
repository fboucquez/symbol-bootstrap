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
import { Logger } from 'symbol-bootstrap-core';
import {
    GenerateNemesisParams,
    HealthCheckParams,
    KeyStore,
    LinkNodesParams,
    NetworkConfigurationService,
    NetworkFile,
    NetworkGenesisService,
    NetworkHealthCheckService,
    NetworkLinkService,
    UpdateNodesParams,
} from '../';

export class NetworkService {
    constructor(private readonly logger: Logger, private readonly workingDir: string) {}

    expandNodes(keyStore: KeyStore): Promise<NetworkFile> {
        return new NetworkConfigurationService(this.logger, this.workingDir, keyStore).expandNodes();
    }

    generateNemesis(keyStore: KeyStore, params: GenerateNemesisParams): Promise<string> {
        return new NetworkGenesisService(this.logger, this.workingDir, keyStore).generateNemesis(params);
    }

    healthCheck(params: HealthCheckParams): Promise<void> {
        return new NetworkHealthCheckService(this.logger, this.workingDir).healthCheck(params);
    }

    linkNodes(keyStore: KeyStore, params: LinkNodesParams): Promise<void> {
        return new NetworkLinkService(this.logger, this.workingDir, keyStore).linkNodes(params);
    }

    updateNodes(keyStore: KeyStore, params: UpdateNodesParams): Promise<void> {
        return new NetworkConfigurationService(this.logger, this.workingDir, keyStore).updateNodes(params);
    }
}
