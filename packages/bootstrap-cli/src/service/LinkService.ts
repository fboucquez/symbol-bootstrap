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

import { prompt } from 'inquirer';
import {
    Addresses,
    AnnounceService,
    BootstrapUtils,
    ConfigLoader,
    ConfigPreset,
    LinkTransactionGenericFactory,
    Logger,
    NodeAccount,
    RemoteNodeService,
    TransactionFactory,
} from 'symbol-bootstrap-core';
import { AccountInfo, Deadline, Transaction, UInt64 } from 'symbol-sdk';
import { BootstrapAccountResolver } from './BootstrapAccountResolver';

/**
 * params necessary to announce link transactions network.
 */
export type LinkParams = {
    target: string;
    password?: string;
    url: string;
    maxFee?: number | undefined;
    unlink: boolean;
    useKnownRestGateways: boolean;
    ready?: boolean;
    customPreset?: string;
    removeOldLinked?: boolean; //TEST ONLY!
};

export interface LinkServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    mainAccountInfo: AccountInfo;
    deadline: Deadline;
    maxFee: UInt64;
    latestFinalizedBlockEpoch?: number;
}

export class LinkService implements TransactionFactory {
    public static readonly defaultParams: LinkParams = {
        target: BootstrapUtils.defaultTargetFolder,
        useKnownRestGateways: false,
        ready: false,
        url: 'http://localhost:3000',
        maxFee: 100000,
        unlink: false,
    };

    private readonly configLoader: ConfigLoader;

    constructor(private readonly logger: Logger, protected readonly params: LinkParams) {
        this.configLoader = new ConfigLoader(logger);
    }

    public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        const customPreset = this.configLoader.loadCustomPreset(this.params.customPreset, this.params.password);
        this.logger.info(`${this.params.unlink ? 'Unlinking' : 'Linking'} nodes`);

        const providedUrl = this.params.url;
        const urls =
            (this.params.useKnownRestGateways && presetData.knownRestGateways) || (providedUrl ? [providedUrl.replace(/\/$/, '')] : []);
        if (!urls.length) {
            throw new Error('URLs could not be resolved!');
        }
        const repositoryInfo = await new RemoteNodeService(this.logger).getBestRepositoryInfo(urls);
        const repositoryFactory = repositoryInfo.repositoryFactory;

        await new AnnounceService(this.logger, new BootstrapAccountResolver(this.logger)).announce(
            repositoryFactory,
            this.params.maxFee,
            this.params.ready,
            this.configLoader.mergePresets(presetData, customPreset),
            addresses,
            this,
        );
    }

    public createTransactions(params: LinkServiceTransactionFactoryParams): Promise<Transaction[]> {
        return new LinkTransactionGenericFactory(this.logger, this.confirmUnlink, this.params.unlink).createTransactions(params);
    }

    private confirmUnlink = async <T>(accountName: string, alreadyLinkedAccount: T, print: (account: T) => string): Promise<boolean> => {
        if (this.params.removeOldLinked === undefined) {
            return (
                this.params.ready ||
                (
                    await prompt([
                        {
                            name: 'value',
                            message: `Do you want to unlink the old ${accountName} ${print(alreadyLinkedAccount)}?`,
                            type: 'confirm',
                            default: false,
                        },
                    ])
                ).value
            );
        }
        return this.params.removeOldLinked;
    };
}
