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

import { prompt } from 'inquirer';
import {
    AccountInfo,
    AccountKeyLinkTransaction,
    Deadline,
    LinkAction,
    NodeKeyLinkTransaction,
    Transaction,
    UInt64,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigAccount, ConfigPreset, NodeAccount } from '../model';
import { AnnounceService, TransactionFactory } from './AnnounceService';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';

/**
 * params necessary to announce link transactions network.
 */
export type LinkParams = {
    target: string;
    readonly password?: string;
    url: string;
    maxFee?: number | undefined;
    unlink: boolean;
    useKnownRestGateways: boolean;
};

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export interface LinkServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    mainAccountInfo: AccountInfo;
    deadline: Deadline;
    maxFee: UInt64;
    removeOldLinked?: boolean;
}

export class LinkService implements TransactionFactory {
    public static readonly defaultParams: LinkParams = {
        target: BootstrapUtils.defaultTargetFolder,
        useKnownRestGateways: false,
        url: 'http://localhost:3000',
        maxFee: 100000,
        unlink: false,
    };

    private readonly configLoader: ConfigLoader;

    constructor(protected readonly params: LinkParams) {
        this.configLoader = new ConfigLoader();
    }

    public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        logger.info(`${this.params.unlink ? 'Unlinking' : 'Linking'} nodes`);

        await new AnnounceService().announce(
            this.params.url,
            this.params.maxFee,
            this.params.useKnownRestGateways,
            presetData,
            addresses,
            this,
        );
    }

    async createTransactions({
        presetData,
        nodeAccount,
        mainAccountInfo,
        deadline,
        maxFee,
        removeOldLinked,
    }: LinkServiceTransactionFactoryParams): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        const unlink = this.params.unlink;
        const networkType = presetData.networkType;

        logger.info('');
        logger.info(`Creating transactions for node: ${nodeAccount.name}, ca/main account: ${mainAccountInfo.address.plain()}`);

        if (nodeAccount.remote) {
            await this.addTransaction(
                mainAccountInfo.supplementalPublicKeys.linked,
                unlink,
                (publicKey, action) => AccountKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee),
                nodeAccount,
                'Remote',
                nodeAccount.remote,
                transactions,
                removeOldLinked,
            );

            await this.addTransaction(
                mainAccountInfo.supplementalPublicKeys.node,
                unlink,
                (publicKey, action) => NodeKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee),
                nodeAccount,
                'Transport/Node',
                nodeAccount.transport,
                transactions,
                removeOldLinked,
            );
        }

        if (nodeAccount.vrf) {
            await this.addTransaction(
                mainAccountInfo.supplementalPublicKeys.vrf,
                unlink,
                (publicKey, action) => VrfKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee),
                nodeAccount,
                'VRF',
                nodeAccount.vrf,
                transactions,
                removeOldLinked,
            );
        }
        if (nodeAccount.voting) {
            const alreadyLinkedAccount = (mainAccountInfo.supplementalPublicKeys?.voting || []).find(
                (a) => a.publicKey.toUpperCase() === nodeAccount.voting?.publicKey.toUpperCase(),
            );
            await this.addTransaction(
                alreadyLinkedAccount,
                unlink,
                (publicKey, action) => BootstrapUtils.createVotingKeyTransaction(publicKey, action, presetData, deadline, maxFee),
                nodeAccount,
                'Voting',
                nodeAccount.voting,
                transactions,
                removeOldLinked,
            );
        }
        return transactions;
    }

    private async addTransaction(
        alreadyLinkedAccount: { publicKey: string } | undefined,
        unlink: boolean,
        transactionFactory: (publicKey: string, action: LinkAction) => Transaction,
        nodeAccount: NodeAccount,
        accountName: string,
        accountTobeLinked: ConfigAccount,
        transactions: Transaction[],
        removeOldLinked: boolean | undefined,
    ): Promise<void> {
        if (unlink) {
            if (alreadyLinkedAccount) {
                if (alreadyLinkedAccount.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase()) {
                    const transaction = transactionFactory(accountTobeLinked.publicKey, LinkAction.Unlink);
                    logger.info(
                        `Creating Unlink ${transaction.constructor.name} for node ${nodeAccount.name} to ${accountName} public key ${accountTobeLinked.publicKey}.`,
                    );
                    transactions.push(transaction);
                } else {
                    logger.warn(
                        `Node ${nodeAccount.name} is linked to a different ${accountName} public key ${alreadyLinkedAccount.publicKey} and not the configured ${accountTobeLinked.publicKey}.`,
                    );

                    if (await this.confirmUnlink(removeOldLinked, accountName, alreadyLinkedAccount)) {
                        const transaction = transactionFactory(alreadyLinkedAccount.publicKey, LinkAction.Unlink);
                        logger.info(
                            `Creating Unlink ${transaction.constructor.name} for node ${nodeAccount.name} to ${accountName} public key ${alreadyLinkedAccount.publicKey}.`,
                        );
                        transactions.push(transaction);
                    }
                }
            } else {
                logger.info(`Node ${nodeAccount.name} is not linked to ${accountName} public key ${accountTobeLinked.publicKey}.`);
                return;
            }
        } else {
            if (alreadyLinkedAccount) {
                if (alreadyLinkedAccount.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase()) {
                    logger.info(
                        `Node ${nodeAccount.name} is already linked to ${accountName} public key ${alreadyLinkedAccount.publicKey}.`,
                    );
                } else {
                    logger.warn(
                        `Node ${nodeAccount.name} is already linked to ${accountName} public key ${alreadyLinkedAccount.publicKey} which is different from the configured ${accountTobeLinked.publicKey}.`,
                    );

                    if (await this.confirmUnlink(removeOldLinked, accountName, alreadyLinkedAccount)) {
                        const unlinkTransaction = transactionFactory(alreadyLinkedAccount.publicKey, LinkAction.Unlink);
                        logger.info(
                            `Creating Unlink ${unlinkTransaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} public key ${alreadyLinkedAccount.publicKey}.`,
                        );
                        transactions.push(unlinkTransaction);

                        const linkTransaction = transactionFactory(accountTobeLinked.publicKey, LinkAction.Link);
                        logger.info(
                            `Creating Link ${linkTransaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} public key ${accountTobeLinked.publicKey}.`,
                        );
                        transactions.push(linkTransaction);
                    }
                }
            } else {
                const transaction = transactionFactory(accountTobeLinked.publicKey, LinkAction.Link);
                logger.info(
                    `Creating Link ${transaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} public key ${accountTobeLinked.publicKey}.`,
                );
                transactions.push(transaction);
            }
        }
    }

    private async confirmUnlink(
        removeOldLinked: boolean | undefined,
        accountName: string,
        alreadyLinkedAccount: { publicKey: string },
    ): Promise<boolean> {
        if (removeOldLinked === undefined) {
            const result = await prompt([
                {
                    name: 'value',
                    message: `Do you want to unlink the old ${accountName} public key ${alreadyLinkedAccount.publicKey}?`,
                    type: 'confirm',
                    default: false,
                },
            ]);
            return result.value;
        }
        return removeOldLinked;
    }
}
