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
import { Deadline, PlainMessage, PublicAccount, Transaction, TransferTransaction, UInt64 } from 'symbol-sdk';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { AnnounceService, TransactionFactory } from './AnnounceService';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';

const logger: Logger = LoggerFactory.getLogger();

export type SupernodeParams = {
    target: string;
    readonly password?: string;
    url: string;
    maxFee?: number;
    useKnownRestGateways: boolean;
};

export interface SupernodeServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    deadline: Deadline;
    maxFee: UInt64;
}

export class SupernodeService implements TransactionFactory {
    public static readonly defaultParams: SupernodeParams = {
        useKnownRestGateways: false,
        target: BootstrapUtils.defaultTargetFolder,
        url: 'http://localhost:3000',
    };

    private readonly configLoader: ConfigLoader;

    constructor(protected readonly params: SupernodeParams) {
        this.configLoader = new ConfigLoader();
    }

    public async enrol(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        if (!presetData.supernodeControllerPublicKey) {
            logger.warn('This network does not have a supernode controller public key. Nodes cannot be registered.');
            return;
        }
        await new AnnounceService().announce(
            this.params.url,
            this.params.maxFee,
            this.params.useKnownRestGateways,
            presetData,
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
    }: SupernodeServiceTransactionFactoryParams): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        const networkType = presetData.networkType;
        if (!nodePreset.supernode) {
            logger.warn(`Node ${nodeAccount.name} hasn't been configured as supernode.`);
            return transactions;
        }
        if (!nodePreset.voting) {
            logger.warn(`Node ${nodeAccount.name} 'voting: true' custom preset flag wasn't provided!`);
            return transactions;
        }
        if (!presetData.supernodeControllerPublicKey) {
            return transactions;
        }

        const supernodeControllerAddress = PublicAccount.createFromPublicKey(presetData.supernodeControllerPublicKey, networkType).address;
        const agentPublicKey = nodeAccount.transport.publicKey;
        if (!agentPublicKey) {
            logger.warn(`Cannot resolve harvester public key of node ${nodeAccount.name}`);
            return transactions;
        }
        if (!nodePreset.host) {
            logger.warn(
                `Node ${nodeAccount.name} public host name hasn't been provided! Please use 'host: myNodeHost' custom preset param.`,
            );
            return transactions;
        }
        const agentUrl = nodePreset.agentUrl || `https://${nodePreset.host}:7880`;
        const plainMessage = `enrol ${agentPublicKey} ${agentUrl}`;
        const message = PlainMessage.create(plainMessage);
        logger.info(`Creating enrolment transfer with message '${plainMessage}'`);
        const transaction: Transaction = TransferTransaction.create(deadline, supernodeControllerAddress, [], message, networkType, maxFee);
        return [transaction];
    }
}
