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

import { firstValueFrom } from 'rxjs';
import { Address, MultisigAccountInfo, RepositoryFactory } from 'symbol-sdk';
import { Logger } from '../logger';
import { ConfigPreset } from '../model';
import { RemoteNodeService } from './RemoteNodeService';

export class TransactionUtils {
    public static async getRepositoryFactory(
        logger: Logger,
        presetData: ConfigPreset,
        url: string | undefined,
    ): Promise<RepositoryFactory> {
        const repositoryInfo = await new RemoteNodeService(logger, presetData, false).getBestRepositoryInfo(url);
        return repositoryInfo.repositoryFactory;
    }

    public static async getMultisigAccount(
        repositoryFactory: RepositoryFactory,
        accountAddress: Address,
    ): Promise<MultisigAccountInfo | undefined> {
        try {
            const info = await firstValueFrom(repositoryFactory.createMultisigRepository().getMultisigAccountInfo(accountAddress));
            return info.isMultisig() ? info : undefined;
        } catch (e) {
            return undefined;
        }
    }
}
