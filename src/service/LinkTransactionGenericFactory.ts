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
import {
    AccountInfo,
    AccountKeyLinkTransaction,
    Deadline,
    LinkAction,
    Transaction,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { Logger } from '../logger';
import { ConfigPreset, NodeAccount } from '../model';
import { TransactionFactory, VotingKeyAccount } from '../service';

export interface LinkServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    mainAccountInfo: AccountInfo;
    deadline: Deadline;
    maxFee: UInt64;
    latestFinalizedBlockEpoch?: number;
}

export type KeyAccount = { publicKey: string };

export interface GenericNodeAccount {
    remote?: KeyAccount;
    vrf?: KeyAccount;
    voting?: VotingKeyAccount[];
}
export type ConfirmUnlink<T> = (accountName: string, alreadyLinkedAccount: T, print: (account: T) => string) => Promise<boolean>;

export class LinkTransactionGenericFactory implements TransactionFactory {
    constructor(private readonly logger: Logger, private readonly confirmUnlink: ConfirmUnlink<any>, private readonly unlink: boolean) {}

    public async createTransactions({
        presetData,
        nodeAccount,
        mainAccountInfo,
        deadline,
        maxFee,
        latestFinalizedBlockEpoch,
    }: LinkServiceTransactionFactoryParams): Promise<Transaction[]> {
        const networkType = presetData.networkType;
        const nodeName = nodeAccount.name;

        const remoteTransactionFactory = ({ publicKey }: KeyAccount, action: LinkAction): AccountKeyLinkTransaction =>
            AccountKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee);
        const vrfTransactionFactory = ({ publicKey }: KeyAccount, action: LinkAction): VrfKeyLinkTransaction =>
            VrfKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee);
        const votingKeyTransactionFactory = (account: VotingKeyAccount, action: LinkAction): VotingKeyLinkTransaction => {
            return VotingKeyLinkTransaction.create(
                deadline,
                account.publicKey,
                account.startEpoch,
                account.endEpoch,
                action,
                networkType,
                1,
                maxFee,
            );
        };

        this.logger.info(`Creating transactions for node: ${nodeName}, ca/main account: ${mainAccountInfo.address.plain()}`);
        const transactions = await this.createGenericTransactions(
            nodeName,
            {
                vrf: mainAccountInfo.supplementalPublicKeys.vrf,
                remote: mainAccountInfo.supplementalPublicKeys.linked,
                voting: mainAccountInfo.supplementalPublicKeys.voting,
            },
            nodeAccount,
            latestFinalizedBlockEpoch || presetData.lastKnownNetworkEpoch,
            remoteTransactionFactory,
            vrfTransactionFactory,
            votingKeyTransactionFactory,
        );
        //Unlink transactions go first.
        return transactions.sort((t1, t2) => t1.linkAction - t2.linkAction);
    }

    public async createGenericTransactions<AccountKL, VRFKL, VotingKL>(
        nodeName: string,
        currentMainAccountKeys: GenericNodeAccount,
        nodeAccount: GenericNodeAccount,
        latestFinalizedBlockEpoch: number,
        remoteTransactionFactory: (keyAccount: KeyAccount, action: LinkAction) => AccountKL,
        vrfTransactionFactory: (keyAccount: KeyAccount, action: LinkAction) => VRFKL,
        votingKeyTransactionFactory: (account: VotingKeyAccount, action: LinkAction) => VotingKL,
    ): Promise<(AccountKL | VRFKL | VotingKL)[]> {
        const transactions: (AccountKL | VRFKL | VotingKL)[] = [];
        const print = (account: { publicKey: string }) => `public key ${account.publicKey}`;
        if (nodeAccount.remote) {
            transactions.push(
                ...(await this.addTransaction(
                    currentMainAccountKeys.remote,
                    remoteTransactionFactory,
                    nodeName,
                    'Remote',
                    nodeAccount.remote,
                    print,
                )),
            );
        }

        if (nodeAccount.vrf) {
            transactions.push(
                ...(await this.addTransaction(currentMainAccountKeys.vrf, vrfTransactionFactory, nodeName, 'VRF', nodeAccount.vrf, print)),
            );
        }
        const votingPrint = (account: VotingKeyAccount) =>
            `public key ${account.publicKey}, start epoch ${account.startEpoch}, end epoch ${account.endEpoch}`;
        if (this.unlink) {
            transactions.push(
                ...(await this.addVotingKeyUnlinkTransactions(
                    currentMainAccountKeys?.voting || [],
                    nodeAccount.voting || [],
                    nodeName,
                    votingKeyTransactionFactory,
                    votingPrint,
                )),
            );
        } else {
            transactions.push(
                ...(await this.addVotingKeyLinkTransactions(
                    currentMainAccountKeys?.voting || [],
                    nodeAccount.voting || [],
                    nodeName,
                    latestFinalizedBlockEpoch,
                    votingKeyTransactionFactory,
                    votingPrint,
                )),
            );
        }
        return transactions;
    }

    public async addVotingKeyLinkTransactions<T>(
        linkedVotingKeyAccounts: VotingKeyAccount[],
        votingKeyFiles: VotingKeyAccount[],
        nodeName: string,
        lastKnownNetworkEpoch: number,
        transactionFactory: (transaction: VotingKeyAccount, action: LinkAction) => T,
        print: (account: VotingKeyAccount) => string,
    ): Promise<T[]> {
        const transactions: T[] = [];
        const accountName = 'Voting';
        let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;
        for (const alreadyLinkedAccount of linkedVotingKeyAccounts) {
            if (
                alreadyLinkedAccount.endEpoch < lastKnownNetworkEpoch &&
                (await this.confirmUnlink(accountName, alreadyLinkedAccount, print))
            ) {
                const unlinkTransaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                this.logger.info(
                    `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
                );
                remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                transactions.push(unlinkTransaction);
            }
        }
        const activeVotingKeyFiles = votingKeyFiles.filter((a) => a.endEpoch >= lastKnownNetworkEpoch);
        for (const accountTobeLinked of activeVotingKeyFiles) {
            const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
                LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a),
            );
            const isAlreadyLinkedSameAccount =
                alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase() &&
                alreadyLinkedAccount?.startEpoch === accountTobeLinked.startEpoch &&
                alreadyLinkedAccount?.endEpoch === accountTobeLinked.endEpoch;

            let addTransaction = !isAlreadyLinkedSameAccount;
            if (alreadyLinkedAccount && !isAlreadyLinkedSameAccount) {
                this.logger.warn(
                    `Node ${nodeName} is already linked to ${accountName} ${print(
                        alreadyLinkedAccount,
                    )} which is different from the configured ${print(accountTobeLinked)}.`,
                );
                if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                    const unlinkTransaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                    this.logger.info(
                        `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(
                            alreadyLinkedAccount,
                        )}.`,
                    );
                    remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                    transactions.push(unlinkTransaction);
                } else {
                    addTransaction = false;
                }
            }

            if (remainingVotingKeys.length < 3 && addTransaction) {
                const transaction = transactionFactory(accountTobeLinked, LinkAction.Link);
                this.logger.info(
                    `Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
                );
                transactions.push(transaction);
                remainingVotingKeys.push(accountTobeLinked);
            }
        }
        return transactions;
    }

    public async addVotingKeyUnlinkTransactions<T>(
        linkedVotingKeyAccounts: VotingKeyAccount[],
        votingKeyFiles: VotingKeyAccount[],
        nodeName: string,
        transactionFactory: (transaction: VotingKeyAccount, action: LinkAction) => T,
        print: (account: VotingKeyAccount) => string,
    ): Promise<T[]> {
        const transactions: T[] = [];
        const accountName = 'Voting';
        let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;
        for (const accountTobeLinked of votingKeyFiles) {
            const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
                LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a),
            );
            const isAlreadyLinkedSameAccount =
                alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase() &&
                alreadyLinkedAccount?.startEpoch === accountTobeLinked.startEpoch &&
                alreadyLinkedAccount?.endEpoch === accountTobeLinked.endEpoch;

            if (alreadyLinkedAccount && isAlreadyLinkedSameAccount) {
                if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                    const unlinkTransaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                    this.logger.info(
                        `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(
                            alreadyLinkedAccount,
                        )}.`,
                    );
                    remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                    transactions.push(unlinkTransaction);
                }
            }
        }
        return transactions;
    }

    public static overlapsVotingAccounts(x: VotingKeyAccount, y: VotingKeyAccount): boolean {
        return x.endEpoch >= y.startEpoch && x.startEpoch <= y.endEpoch;
    }

    private async addTransaction<A extends KeyAccount, T>(
        alreadyLinkedAccount: A | undefined,
        transactionFactory: (transaction: A, action: LinkAction) => T,
        nodeName: string,
        accountName: string,
        accountTobeLinked: A,
        print: (account: A) => string,
    ): Promise<T[]> {
        const transactions: T[] = [];
        const isAlreadyLinkedSameAccount = accountTobeLinked.publicKey.toUpperCase() === alreadyLinkedAccount?.publicKey.toUpperCase();
        if (this.unlink) {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    const transaction = transactionFactory(accountTobeLinked, LinkAction.Unlink);
                    this.logger.info(
                        `Creating Unlink ${accountName} Transaction for node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
                    );
                    transactions.push(transaction);
                } else {
                    this.logger.warn(
                        `Node ${nodeName} is linked to a different ${accountName} ${print(
                            alreadyLinkedAccount,
                        )} and not the configured ${print(accountTobeLinked)}.`,
                    );

                    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                        const transaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                        this.logger.info(
                            `Creating Unlink ${accountName} Transaction  for node ${nodeName} to ${accountName} ${print(
                                alreadyLinkedAccount,
                            )}.`,
                        );
                        transactions.push(transaction);
                    }
                }
            } else {
                this.logger.info(`Node ${nodeName} is not linked to ${accountName} ${print(accountTobeLinked)}.`);
            }
        } else {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    this.logger.info(`Node ${nodeName} is already linked to ${accountName} ${print(alreadyLinkedAccount)}.`);
                } else {
                    this.logger.warn(
                        `Node ${nodeName} is already linked to ${accountName} ${print(
                            alreadyLinkedAccount,
                        )} which is different from the configured ${print(accountTobeLinked)}.`,
                    );

                    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                        const unlinkTransaction = transactionFactory(alreadyLinkedAccount, LinkAction.Unlink);
                        this.logger.info(
                            `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(
                                alreadyLinkedAccount,
                            )}.`,
                        );
                        transactions.push(unlinkTransaction);

                        const linkTransaction = transactionFactory(accountTobeLinked, LinkAction.Link);
                        this.logger.info(
                            `Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
                        );
                        transactions.push(linkTransaction);
                    }
                }
            } else {
                const transaction = transactionFactory(accountTobeLinked, LinkAction.Link);
                this.logger.info(
                    `Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
                );
                transactions.push(transaction);
            }
        }
        return transactions;
    }
}
