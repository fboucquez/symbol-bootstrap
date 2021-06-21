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
    Account,
    AccountInfo,
    Address,
    AggregateTransaction,
    Deadline,
    LockFundsTransaction,
    MosaicId,
    MultisigAccountInfo,
    PublicAccount,
    RepositoryFactory,
    SignedTransaction,
    Transaction,
    TransactionService,
    UInt64,
} from 'symbol-sdk';
import { Addresses, ConfigPreset, KeyName, Logger, NodeAccount, NodePreset } from '../';
import { AccountResolver } from './AccountResolver';

export interface TransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    mainAccountInfo: AccountInfo;
    mainAccount: PublicAccount;
    deadline: Deadline;
    maxFee: UInt64;
    latestFinalizedBlockEpoch: number;
}

export interface TransactionFactory {
    createTransactions(params: TransactionFactoryParams): Promise<Transaction[]>;
}

export class AnnounceService {
    constructor(private readonly logger: Logger, private readonly accountResolver: AccountResolver) {}

    private static onProcessListener = () => {
        process.on('SIGINT', () => {
            process.exit(400);
        });
    };

    public async announce(
        repositoryFactory: RepositoryFactory,
        providedMaxFee: number | undefined,
        ready: boolean | undefined,
        presetData: ConfigPreset,
        addresses: Addresses,
        transactionFactory: TransactionFactory,
        tokenAmount = 'some',
    ): Promise<void> {
        AnnounceService.onProcessListener();
        if (!presetData.nodes || !presetData.nodes?.length) {
            this.logger.info(`There are no transactions to announce...`);
            return;
        }
        const minFeeMultiplier = (await repositoryFactory.createNetworkRepository().getTransactionFees().toPromise()).minFeeMultiplier;
        const latestFinalizedBlockEpoch = (await repositoryFactory.createChainRepository().getChainInfo().toPromise()).latestFinalizedBlock
            .finalizationEpoch;

        const networkType = await repositoryFactory.getNetworkType().toPromise();
        const epochAdjustment = await repositoryFactory.getEpochAdjustment().toPromise();
        const currency = (await repositoryFactory.getCurrencies().toPromise()).currency;

        const deadline = Deadline.create(epochAdjustment);

        const currencyMosaicId = currency.mosaicId;
        const faucetUrl = presetData.faucetUrl;
        const listener = repositoryFactory.createListener();
        await listener.open();
        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        if (providedMaxFee) {
            this.logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, currency.divisibility)}`);
        } else {
            this.logger.info(`Node's minFeeMultiplier is ${minFeeMultiplier}`);
        }

        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        if (generationHash?.toUpperCase() !== presetData.nemesisGenerationHashSeed?.toUpperCase()) {
            throw new Error(
                `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`,
            );
        }

        for (const [index, nodeAccount] of (addresses.nodes || []).entries()) {
            if (!nodeAccount || !nodeAccount.main) {
                throw new Error('CA/Main account is required!');
            }
            const nodePreset = (presetData.nodes || [])[index];
            const mainAccount = PublicAccount.createFromPublicKey(nodeAccount.main.publicKey, presetData.networkType);
            const noFundsMessage = faucetUrl
                ? `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${mainAccount.address.plain()} via ${faucetUrl}/?recipient=${mainAccount.address.plain()}`
                : `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${mainAccount.address.plain()} .`;
            const mainAccountInfo = await this.getAccountInfo(repositoryFactory, mainAccount.address);

            if (!mainAccountInfo) {
                this.logger.error(`Node signing account ${mainAccount.address.plain()} is not valid.`);
                this.logger.error(noFundsMessage);
                continue;
            }
            if (this.isAccountEmpty(mainAccountInfo, currencyMosaicId)) {
                this.logger.error(
                    `Node signing account ${mainAccount.address.plain()} does not have enough currency. Mosaic id: ${currencyMosaicId}. \n\n${noFundsMessage}`,
                );
                continue;
            }
            const defaultMaxFee = UInt64.fromUint(providedMaxFee || 0);
            const multisigAccountInfo = await this.getMultisigAccount(repositoryFactory, mainAccount.address);
            const params: TransactionFactoryParams = {
                presetData,
                nodePreset,
                nodeAccount,
                mainAccountInfo,
                latestFinalizedBlockEpoch,
                mainAccount,
                deadline,
                maxFee: defaultMaxFee,
            };
            const transactions = await transactionFactory.createTransactions(params);
            if (!transactions.length) {
                this.logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
                continue;
            }

            const getTransactionDescription = (transaction: Transaction, signedTransaction: SignedTransaction): string => {
                return `${transaction.constructor.name} - Hash: ${signedTransaction.hash} - MaxFee ${
                    transaction.maxFee.compact() / Math.pow(10, currency.divisibility)
                }`;
            };

            const shouldAnnounce = async (transaction: Transaction, signedTransaction: SignedTransaction): Promise<boolean> => {
                const response =
                    ready ||
                    (await this.accountResolver.shouldAnnounce(
                        transaction,
                        signedTransaction,
                        getTransactionDescription(transaction, signedTransaction),
                    ));
                if (!response) {
                    this.logger.info(`Ignoring transaction for node ${nodeAccount.name}`);
                }
                return response;
            };

            const resolveMainAccount = async (): Promise<Account> => {
                const presetMainPrivateKey = (presetData.nodes || [])[index]?.mainPrivateKey;
                if (presetMainPrivateKey) {
                    const account = Account.createFromPrivateKey(presetMainPrivateKey, networkType);
                    if (account.address.equals(mainAccount.address)) {
                        return account;
                    }
                }

                return await this.accountResolver.resolveAccount(
                    networkType,
                    nodeAccount.main,
                    KeyName.Main,
                    nodeAccount.name,
                    'signing a transaction',
                    'Should not generate!',
                );
            };

            if (multisigAccountInfo) {
                this.logger.info(
                    `The node's main account is a multig account with Address: ${
                        multisigAccountInfo.minApproval
                    } min approval. Cosigners are: ${multisigAccountInfo.cosignatoryAddresses
                        .map((a) => a.plain())
                        .join(
                            ', ',
                        )}. The tool will ask for the cosigners provide keys in order to announce the transactions. These private keys are not stored anywhere!`,
                );
                const cosigners = await this.accountResolver.resolveCosigners(
                    networkType,
                    multisigAccountInfo.cosignatoryAddresses,
                    multisigAccountInfo.minApproval,
                );
                if (!cosigners.length) {
                    this.logger.info('No cosigner has been provided, ignoring!');
                    continue;
                }
                const bestCosigner = await this.getBestCosigner(repositoryFactory, cosigners, currencyMosaicId);
                if (!bestCosigner) {
                    this.logger.info(`There is no cosigner with enough tokens to announce!`);
                    continue;
                }
                this.logger.info(`Cosigner ${bestCosigner.address.plain()} is initializing the transactions.`);
                if (cosigners.length >= multisigAccountInfo.minApproval) {
                    let aggregateTransaction = AggregateTransaction.createComplete(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount)),
                        networkType,
                        [],
                        defaultMaxFee,
                    );
                    if (!providedMaxFee) {
                        aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, cosigners.length - 1);
                    }
                    const signedAggregateTransaction = bestCosigner.signTransactionWithCosignatories(
                        aggregateTransaction,
                        cosigners.filter((a) => a !== bestCosigner),
                        generationHash,
                    );
                    if (!(await shouldAnnounce(aggregateTransaction, signedAggregateTransaction))) {
                        continue;
                    }
                    try {
                        this.logger.info(`Announcing ${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)}`);
                        await transactionService.announce(signedAggregateTransaction, listener).toPromise();
                        this.logger.info(
                            `${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)} has been confirmed`,
                        );
                    } catch (e) {
                        const message =
                            `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        this.logger.error(message);
                    }
                } else {
                    let aggregateTransaction = AggregateTransaction.createBonded(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount)),
                        networkType,
                        [],
                        defaultMaxFee,
                    );
                    if (!providedMaxFee) {
                        aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, cosigners.length - 1);
                    }
                    const signedAggregateTransaction = bestCosigner.signTransactionWithCosignatories(
                        aggregateTransaction,
                        cosigners.filter((a) => a !== bestCosigner),
                        generationHash,
                    );
                    let lockFundsTransaction: Transaction = LockFundsTransaction.create(
                        deadline,
                        currency.createRelative(10),
                        UInt64.fromUint(1000),
                        signedAggregateTransaction,
                        networkType,
                        defaultMaxFee,
                    );
                    if (!providedMaxFee) {
                        lockFundsTransaction = lockFundsTransaction.setMaxFee(minFeeMultiplier);
                    }
                    const signedLockFundsTransaction = bestCosigner.sign(lockFundsTransaction, generationHash);
                    if (!(await shouldAnnounce(lockFundsTransaction, signedLockFundsTransaction))) {
                        continue;
                    }
                    if (!(await shouldAnnounce(aggregateTransaction, signedAggregateTransaction))) {
                        continue;
                    }

                    try {
                        this.logger.info(`Announcing ${getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction)}`);
                        await transactionService.announce(signedLockFundsTransaction, listener).toPromise();
                        this.logger.info(
                            `${getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction)} has been confirmed`,
                        );

                        this.logger.info(
                            `Announcing Bonded ${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)}`,
                        );
                        await transactionService.announceAggregateBonded(signedAggregateTransaction, listener).toPromise();
                        this.logger.info(
                            `${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)} has been announced`,
                        );

                        this.logger.info('Aggregate Bonded Transaction has been confirmed! Your cosigners would need to cosign!');
                    } catch (e) {
                        const message =
                            `Aggregate Bonded Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        this.logger.error(message);
                    }
                }
            } else {
                const signerAccount = await resolveMainAccount();
                if (transactions.length == 1) {
                    let transaction = transactions[0];
                    if (!providedMaxFee) {
                        transaction = transaction.setMaxFee(minFeeMultiplier);
                    }
                    const signedTransaction = signerAccount.sign(transactions[0], generationHash);
                    if (!(await shouldAnnounce(transaction, signedTransaction))) {
                        continue;
                    }
                    try {
                        this.logger.info(`Announcing ${getTransactionDescription(transaction, signedTransaction)}`);
                        await transactionService.announce(signedTransaction, listener).toPromise();
                        this.logger.info(`${getTransactionDescription(transaction, signedTransaction)} has been confirmed`);
                    } catch (e) {
                        const message =
                            `Simple Transaction ${signedTransaction.type} ${signedTransaction.hash} - signer ${signedTransaction
                                .getSignerAddress()
                                .plain()} failed!! ` + e.message;
                        this.logger.error(message);
                    }
                } else {
                    let aggregateTransaction = AggregateTransaction.createComplete(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount)),
                        networkType,
                        [],
                        defaultMaxFee,
                    );
                    if (!providedMaxFee) {
                        aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, 0);
                    }
                    const signedAggregateTransaction = signerAccount.sign(aggregateTransaction, generationHash);
                    if (!(await shouldAnnounce(aggregateTransaction, signedAggregateTransaction))) {
                        continue;
                    }
                    try {
                        this.logger.info(`Announcing ${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)}`);
                        await transactionService.announce(signedAggregateTransaction, listener).toPromise();
                        this.logger.info(
                            `${getTransactionDescription(aggregateTransaction, signedAggregateTransaction)} has been confirmed`,
                        );
                    } catch (e) {
                        const message =
                            `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        this.logger.error(message);
                    }
                }
            }
        }

        listener.close();
    }

    private async getAccountInfo(repositoryFactory: RepositoryFactory, mainAccountAddress: Address): Promise<AccountInfo | undefined> {
        try {
            return await repositoryFactory.createAccountRepository().getAccountInfo(mainAccountAddress).toPromise();
        } catch (e) {
            return undefined;
        }
    }

    private async getMultisigAccount(
        repositoryFactory: RepositoryFactory,
        mainAccountAddress: Address,
    ): Promise<MultisigAccountInfo | undefined> {
        try {
            const info = await repositoryFactory.createMultisigRepository().getMultisigAccountInfo(mainAccountAddress).toPromise();
            return info.isMultisig() ? info : undefined;
        } catch (e) {
            return undefined;
        }
    }

    private async getBestCosigner(
        repositoryFactory: RepositoryFactory,
        cosigners: Account[],
        currencyMosaicId: MosaicId | undefined,
    ): Promise<Account | undefined> {
        const accountRepository = repositoryFactory.createAccountRepository();
        for (const cosigner of cosigners) {
            try {
                const accountInfo = await accountRepository.getAccountInfo(cosigner.address).toPromise();
                if (!this.isAccountEmpty(accountInfo, currencyMosaicId)) {
                    return cosigner;
                }
            } catch (e) {}
        }
        return undefined;
    }

    private isAccountEmpty(mainAccountInfo: AccountInfo, currencyMosaicId: MosaicId | undefined): boolean {
        if (!currencyMosaicId) {
            throw new Error('Mosaic Id must not be null!');
        }
        const mosaic = mainAccountInfo.mosaics.find((m) => m.id.equals(currencyMosaicId));
        return !mosaic || mosaic.amount.compare(UInt64.fromUint(0)) < 1;
    }
}
