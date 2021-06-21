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
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    Addresses,
    AnnounceService,
    BootstrapUtils,
    ConfigLoader,
    ConfigPreset,
    Logger,
    NodeAccount,
    NodePreset,
    RemoteNodeService,
    TransactionFactory,
} from 'symbol-bootstrap-core';
import { Address, Deadline, PlainMessage, Transaction, TransferTransaction, UInt64 } from 'symbol-sdk';
import { BootstrapAccountResolver } from './BootstrapAccountResolver';

export type RewardProgramParams = {
    target: string;
    password?: string;
    url: string;
    maxFee?: number;
    useKnownRestGateways: boolean;
    ready?: boolean;
    customPreset?: string;
};

export interface RewardProgramServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    deadline: Deadline;
    maxFee: UInt64;
}

export class RewardProgramService implements TransactionFactory {
    public static readonly defaultParams: RewardProgramParams = {
        useKnownRestGateways: false,
        target: BootstrapUtils.defaultTargetFolder,
        url: 'http://localhost:3000',
    };

    private readonly configLoader: ConfigLoader;

    constructor(private readonly logger: Logger, protected readonly params: RewardProgramParams) {
        this.configLoader = new ConfigLoader(logger);
    }

    public async enroll(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        const customPreset = this.configLoader.loadCustomPreset(this.params.customPreset, this.params.password);
        if (!presetData.rewardProgramEnrollmentAddress) {
            this.logger.warn('This network does not have a reward program controller public key. Nodes cannot be registered.');
            return;
        }

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
            '1M+',
        );
    }

    async createTransactions({
        presetData,
        nodePreset,
        nodeAccount,
        deadline,
        maxFee,
    }: RewardProgramServiceTransactionFactoryParams): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        const networkType = presetData.networkType;
        if (!nodePreset.rewardProgram) {
            this.logger.warn(`Node ${nodeAccount.name} hasn't been configured with rewardProgram: preset property.`);
            return transactions;
        }

        if (!presetData.rewardProgramEnrollmentAddress) {
            return transactions;
        }
        const rewardProgramEnrollmentAddress = Address.createFromRawAddress(presetData.rewardProgramEnrollmentAddress);
        const agentPublicKey = nodeAccount.transport.publicKey;
        if (!agentPublicKey) {
            this.logger.warn(`Cannot resolve harvester public key of node ${nodeAccount.name}`);
            return transactions;
        }
        if (!nodePreset.host) {
            this.logger.warn(
                `Node ${nodeAccount.name} public host name hasn't been provided! Please use 'host: myNodeHost' custom preset param.`,
            );
            return transactions;
        }
        const agentUrl =
            nodePreset.agentUrl || `https://${nodePreset.host}:${nodePreset.rewardProgramAgentPort || presetData.rewardProgramAgentPort}`;
        const certFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, nodePreset.name, 'agent');
        const base64AgentCaCsrFile = readFileSync(join(certFolder, 'agent-ca.csr.pem'), 'base64');
        const plainMessage = `enroll ${agentUrl} ${base64AgentCaCsrFile}`;
        const message = PlainMessage.create(plainMessage);
        this.logger.info(`Creating enrolment transfer with message '${plainMessage}'`);
        const transaction: Transaction = TransferTransaction.create(
            deadline,
            rewardProgramEnrollmentAddress,
            [],
            message,
            networkType,
            maxFee,
        );
        return [transaction];
    }
}
