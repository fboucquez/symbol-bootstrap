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
    AccountLinkVotingKey,
    Deadline,
    LinkAction,
    Transaction,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset, NodeAccount } from '../model';
import { AnnounceService, TransactionFactory } from './AnnounceService';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';

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
        ready: false,
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
            this.params.ready,
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
            const accountTobeLinked = nodeAccount.remote;
            const alreadyLinkedAccount = mainAccountInfo.supplementalPublicKeys.linked;
            const isAlreadyLinkedSameAccount = alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase();
            await this.addTransaction(
                alreadyLinkedAccount,
                isAlreadyLinkedSameAccount,
                unlink,
                ({ publicKey }, action) => AccountKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee),
                nodeAccount,
                'Remote',
                nodeAccount.remote,
                transactions,
                removeOldLinked,
                (account) => `public key ${account.publicKey}`,
            );
        }

        if (nodeAccount.vrf) {
            const accountTobeLinked = nodeAccount.vrf;
            const alreadyLinkedAccount = mainAccountInfo.supplementalPublicKeys.vrf;
            const isAlreadyLinkedSameAccount = alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase();
            await this.addTransaction(
                alreadyLinkedAccount,
                isAlreadyLinkedSameAccount,
                unlink,
                ({ publicKey }, action) => VrfKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee),
                nodeAccount,
                'VRF',
                accountTobeLinked,
                transactions,
                removeOldLinked,
                (account) => `public key ${account.publicKey}`,
            );
        }
        if (nodeAccount.voting) {
            const accountTobeLinked = {
                publicKey: nodeAccount.voting.publicKey,
                startEpoch: presetData.votingKeyStartEpoch,
                endEpoch: presetData.votingKeyEndEpoch,
            };
            const alreadyLinkedAccount = (mainAccountInfo.supplementalPublicKeys?.voting || []).find((a) =>
                LinkService.overlapsVotingAccounts(accountTobeLinked, a),
            );

            const isAlreadyLinkedSameAccount =
                alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase() &&
                alreadyLinkedAccount?.startEpoch === accountTobeLinked.startEpoch &&
                alreadyLinkedAccount?.endEpoch === accountTobeLinked.endEpoch;

            await this.addTransaction(
                alreadyLinkedAccount,
                isAlreadyLinkedSameAccount,
                unlink,
                (votingKeyAccount, action) => {
                    return VotingKeyLinkTransaction.create(
                        deadline,
                        votingKeyAccount.publicKey,
                        votingKeyAccount.startEpoch,
                        votingKeyAccount.endEpoch,
                        action,
                        presetData.networkType,
                        1,
                        maxFee,
                    );
                },
                nodeAccount,
                'Voting',
                accountTobeLinked,
                transactions,
                removeOldLinked,
                (account) => `public key ${account.publicKey}, start epoch ${account.startEpoch}, end epoch ${account.endEpoch}`,
            );
        }
        return transactions;
    }

    public static overlapsVotingAccounts(x: AccountLinkVotingKey, y: AccountLinkVotingKey): boolean {
        return x.endEpoch >= y.startEpoch && x.startEpoch <= y.endEpoch;
    }

    private async addTransaction<T>(
        alreadyLinkedAccount: T | undefined,
        isAlreadyLinkedSameAccount: boolean,
        unlink: boolean,
        transactionFactory: (transaction: T, action: LinkAction) => Transaction,
        nodeAccount: NodeAccount,
        accountName: string,
        accountTobeLinked: T,
        transactions: Transaction[],
        removeOldLinked: boolean | undefined,
        print: (account: T) => string,
    ): Promise<void> {
        if (unlink) {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    const transaction = transactionFactory(accountTobeLinked, LinkAction.Unlink);
                    logger.info(
                        `Creating Unlink ${transaction.constructor.name} for node ${nodeAccount.name} to ${accountName} ${print(
                            accountTobeLinked,
                        )}.`,
                    );
                    transactions.push(transaction);
                } else {
                    logger.warn(
                        `Node ${nodeAccount.name} is linked to a different ${accountName} ${print(
                            alreadyLinkedAccount,
                        )} and not the configured ${print(accountTobeLinked)}.`,
                    );

                    if (await this.confirmUnlink(removeOldLinked, accountName, alreadyLinkedAccount, print)) {
                        const transaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                        logger.info(
                            `Creating Unlink ${transaction.constructor.name} for node ${nodeAccount.name} to ${accountName} ${print(
                                alreadyLinkedAccount,
                            )}.`,
                        );
                        transactions.push(transaction);
                    }
                }
            } else {
                logger.info(`Node ${nodeAccount.name} is not linked to ${accountName} ${print(accountTobeLinked)}.`);
                return;
            }
        } else {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    logger.info(`Node ${nodeAccount.name} is already linked to ${accountName} ${print(alreadyLinkedAccount)}.`);
                } else {
                    logger.warn(
                        `Node ${nodeAccount.name} is already linked to ${accountName} ${print(
                            alreadyLinkedAccount,
                        )} which is different from the configured ${print(accountTobeLinked)}.`,
                    );

                    if (await this.confirmUnlink(removeOldLinked, accountName, alreadyLinkedAccount, print)) {
                        const unlinkTransaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                        logger.info(
                            `Creating Unlink ${unlinkTransaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} ${print(
                                alreadyLinkedAccount,
                            )}.`,
                        );
                        transactions.push(unlinkTransaction);

                        const linkTransaction = transactionFactory(accountTobeLinked, LinkAction.Link);
                        logger.info(
                            `Creating Link ${linkTransaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} ${print(
                                accountTobeLinked,
                            )}.`,
                        );
                        transactions.push(linkTransaction);
                    }
                }
            } else {
                const transaction = transactionFactory(accountTobeLinked, LinkAction.Link);
                logger.info(
                    `Creating Link ${transaction.constructor.name} from Node ${nodeAccount.name} to ${accountName} ${print(
                        accountTobeLinked,
                    )}.`,
                );
                transactions.push(transaction);
            }
        }
    }

    private async confirmUnlink<T>(
        removeOldLinked: boolean | undefined,
        accountName: string,
        alreadyLinkedAccount: T,
        print: (account: T) => string,
    ): Promise<boolean> {
        if (removeOldLinked === undefined) {
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
        return removeOldLinked;
    }
}
