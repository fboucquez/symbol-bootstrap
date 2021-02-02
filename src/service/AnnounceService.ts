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
import { flags } from '@oclif/command';
import { prompt } from 'inquirer';
import {
    Account,
    AccountInfo,
    Address,
    AggregateTransaction,
    ChainInfo,
    Convert,
    Deadline,
    LockFundsTransaction,
    MosaicId,
    MultisigAccountInfo,
    NetworkType,
    RepositoryFactory,
    RepositoryFactoryHttp,
    Transaction,
    TransactionService,
    UInt64,
} from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export interface TransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    mainAccountInfo: AccountInfo;
    mainAccount: Account;
    deadline: Deadline;
    maxFee: UInt64;
}

export interface TransactionFactory {
    createTransactions(params: TransactionFactoryParams): Promise<Transaction[]>;
}

export interface RepositoryInfo {
    repositoryFactory: RepositoryFactory;
    restGatewayUrl: string;
    generationHash?: string;
    chainInfo?: ChainInfo;
}

export class AnnounceService {
    private static onProcessListener = () => {
        process.on('SIGINT', () => {
            process.exit(400);
        });
    };
    public static flags = {
        password: BootstrapUtils.passwordFlag,
        url: flags.string({
            char: 'u',
            description: 'the network url',
            default: 'http://localhost:3000',
        }),
        useKnownRestGateways: flags.boolean({
            description:
                'Use the best NEM node available when announcing. Otherwise the command will use the node provided by the --url parameter.',
        }),
        maxFee: flags.integer({
            description: 'the max fee used when announcing (absolute). The node min multiplier will be used if it is not provided.',
        }),
    };
    public async announce(
        providedUrl: string,
        providedMaxFee: number | undefined,
        useKnownRestGateways: boolean,
        presetData: ConfigPreset,
        addresses: Addresses,
        transactionFactory: TransactionFactory,
        tokenAmount = 'some',
    ): Promise<void> {
        AnnounceService.onProcessListener();
        if (!presetData.nodes || !presetData.nodes?.length) {
            logger.info(`There are no transactions to announce...`);
            return;
        }

        const url = providedUrl.replace(/\/$/, '');
        let repositoryFactory: RepositoryFactory;
        const urls = (useKnownRestGateways && presetData.knownRestGateways) || [];
        if (urls.length) {
            urls.push(url);
            const repositoryInfo = this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls))[0];
            if (!repositoryInfo) {
                throw new Error(`No up and running node could be found of out: ${urls.join(', ')}`);
            }
            repositoryFactory = repositoryInfo.repositoryFactory;
            logger.info(`Connecting to node ${repositoryInfo.restGatewayUrl}`);
        } else {
            repositoryFactory = new RepositoryFactoryHttp(url);
            logger.info(`Connecting to node ${url}`);
        }

        const networkType = await repositoryFactory.getNetworkType().toPromise();
        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const epochAdjustment = await repositoryFactory.getEpochAdjustment().toPromise();
        const listener = repositoryFactory.createListener();
        await listener.open();
        const faucetUrl = presetData.faucetUrl;
        const currency = (await repositoryFactory.getCurrencies().toPromise()).currency;
        const currencyMosaicId = currency.mosaicId;
        const deadline = Deadline.create(epochAdjustment);
        const minFeeMultiplier = (await repositoryFactory.createNetworkRepository().getTransactionFees().toPromise()).minFeeMultiplier;
        if (providedMaxFee) {
            logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, currency.divisibility)}`);
        } else {
            logger.info(`Node's minFeeMultiplier is ${minFeeMultiplier}`);
        }

        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        if (generationHash !== presetData.nemesisGenerationHashSeed) {
            throw new Error(
                `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`,
            );
        }

        for (const [index, nodeAccount] of (addresses.nodes || []).entries()) {
            if (!nodeAccount || !nodeAccount.main) {
                throw new Error('CA/Main account is required!');
            }
            const nodePreset = (presetData.nodes || [])[index];
            const mainAccount = Account.createFromPrivateKey(nodeAccount.main.privateKey, presetData.networkType);
            const noFundsMessage = faucetUrl
                ? `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${mainAccount.address.plain()} via ${faucetUrl}/?recipient=${mainAccount.address.plain()}`
                : `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${mainAccount.address.plain()} .`;
            const mainAccountInfo = await this.getAccountInfo(repositoryFactory, mainAccount);

            if (!mainAccountInfo) {
                logger.error(`Node signing account ${mainAccount.address.plain()} is not valid. \n\n${noFundsMessage}`);
                continue;
            }
            if (this.isAccountEmpty(mainAccountInfo, currencyMosaicId)) {
                logger.error(
                    `Node signing account ${mainAccount.address.plain()} does not have enough currency. Mosaic id: ${currencyMosaicId}. \n\n${noFundsMessage}`,
                );
                continue;
            }
            const defaultMaxFee = UInt64.fromUint(providedMaxFee || 0);
            const multisigAccountInfo = await this.getMultisigAccount(repositoryFactory, mainAccount);
            const params: TransactionFactoryParams = {
                presetData,
                nodePreset,
                nodeAccount,
                mainAccountInfo,
                mainAccount,
                deadline,
                maxFee: defaultMaxFee,
            };
            const transactions = await transactionFactory.createTransactions(params);
            if (!transactions.length) {
                logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
                continue;
            }
            if (
                !(
                    await prompt([
                        {
                            name: 'value',
                            message: `Do you want to announce ${transactions.length} transactions for node ${nodeAccount.name}`,
                            type: 'confirm',
                            default: true,
                        },
                    ])
                ).value
            ) {
                logger.info(`Ignoring transaction for node ${nodeAccount.name}`);
                continue;
            }

            if (multisigAccountInfo) {
                logger.info(
                    `The node's main account is a multig account with ${
                        multisigAccountInfo.minApproval
                    } min approval. Cosigners are: ${multisigAccountInfo.cosignatoryAddresses
                        .map((a) => a.plain())
                        .join(
                            ', ',
                        )}. The tool will ask for the cosigners provide keys in order to announce the transactions. These private keys are not stored anywhere!`,
                );
                const cosigners = await this.promptAccounts(
                    networkType,
                    multisigAccountInfo.cosignatoryAddresses,
                    multisigAccountInfo.minApproval,
                );
                if (!cosigners.length) {
                    logger.info('No cosigner has been provided, ignoring!');
                    continue;
                }
                const bestCosigner = await this.getBestCosigner(repositoryFactory, cosigners, currencyMosaicId);
                if (!bestCosigner) {
                    logger.info(`There is no cosigner with enough tokens to announce!`);
                    continue;
                }
                logger.info(`Cosigner ${bestCosigner.address.plain()} is initializing the transactions.`);
                if (cosigners.length >= multisigAccountInfo.minApproval) {
                    let aggregateTransaction = AggregateTransaction.createComplete(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount.publicAccount)),
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
                    try {
                        logger.info(`Announcing Multisig Aggregate Complete Transaction hash ${signedAggregateTransaction.hash}`);
                        await transactionService.announce(signedAggregateTransaction, listener).toPromise();
                        logger.info('Aggregate Complete Transaction has been confirmed!');
                    } catch (e) {
                        const message =
                            `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        logger.error(message);
                    }
                } else {
                    let aggregateTransaction = AggregateTransaction.createBonded(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount.publicAccount)),
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
                    try {
                        logger.info(`Announcing Lock Funds Transaction hash ${signedLockFundsTransaction.hash}`);
                        await transactionService.announce(signedLockFundsTransaction, listener).toPromise();

                        logger.info(`Announcing Aggregate Bonded Transaction hash ${signedAggregateTransaction.hash}`);
                        await transactionService.announceAggregateBonded(signedAggregateTransaction, listener).toPromise();

                        logger.info('Aggregate Bonded Transaction has been confirmed! Your cosigners would need to cosign!');
                    } catch (e) {
                        const message =
                            `Aggregate Bonded Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        logger.error(message);
                    }
                }
            } else {
                if (transactions.length == 1) {
                    let transaction = transactions[0];
                    if (!providedMaxFee) {
                        transaction = transaction.setMaxFee(minFeeMultiplier);
                    }
                    const signedTransaction = mainAccount.sign(transactions[0], generationHash);
                    try {
                        logger.info(`Announcing Simple Transaction hash ${signedTransaction.hash}`);
                        await transactionService.announce(signedTransaction, listener).toPromise();
                        logger.info('Transaction has been confirmed!');
                    } catch (e) {
                        const message =
                            `Simple Transaction ${signedTransaction.type} ${
                                signedTransaction.hash
                            } - signer ${signedTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        logger.error(message);
                    }
                } else {
                    let aggregateTransaction = AggregateTransaction.createComplete(
                        deadline,
                        transactions.map((t) => t.toAggregate(mainAccount.publicAccount)),
                        networkType,
                        [],
                        defaultMaxFee,
                    );
                    if (!providedMaxFee) {
                        aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, 0);
                    }
                    const signedAggregateTransaction = mainAccount.sign(aggregateTransaction, generationHash);
                    try {
                        logger.info(`Announcing Aggregate Complete Transaction hash ${signedAggregateTransaction.hash}`);
                        await transactionService.announce(signedAggregateTransaction, listener).toPromise();
                        logger.info('Aggregate Complete Transaction has been confirmed!');
                    } catch (e) {
                        const message =
                            `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                                signedAggregateTransaction.hash
                            } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        logger.error(message);
                    }
                }
            }
        }

        listener.close();
    }

    private async promptAccounts(networkType: NetworkType, expectedAddresses: Address[], minApproval: number): Promise<Account[]> {
        const providedAccounts: Account[] = [];
        const allowedAddresses = [...expectedAddresses];
        while (true) {
            console.log();
            const expectedDescription = allowedAddresses.map((address) => address.plain()).join(', ');
            const responses = await prompt([
                {
                    name: 'privateKey',
                    message: `Enter the 64 HEX private key of one of the addresses ${expectedDescription}. Already entered ${providedAccounts.length} out of ${minApproval} required cosigners.`,
                    type: 'password',
                    validate: AnnounceService.isValidPrivateKey,
                },
            ]);
            const privateKey = responses.privateKey;
            if (!privateKey) {
                console.log('Please provide the private key....');
            } else {
                const account = Account.createFromPrivateKey(privateKey, networkType);
                const expectedAddress = allowedAddresses.find((address) => address.equals(account.address));
                if (!expectedAddress) {
                    console.log();
                    console.log(
                        `Invalid private key. The entered private key has this ${account.address.plain()} address and it's not one of ${expectedDescription}. \n`,
                    );
                    console.log(`Please re enter private key...`);
                } else {
                    allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
                    providedAccounts.push(account);
                    if (!allowedAddresses.length) {
                        console.log('All cosigners have been entered.');
                        return providedAccounts;
                    }
                    if (providedAccounts.length == minApproval) {
                        console.log(`Min Approval of ${minApproval} has been reached. Aggregate Complete transaction can be created.`);
                        return providedAccounts;
                    }
                    const responses = await prompt([
                        {
                            name: 'more',
                            message: `Do you want to enter more cosigners?`,
                            type: 'confirm',
                            default: providedAccounts.length < minApproval,
                        },
                    ]);
                    if (!responses.more) {
                        return providedAccounts;
                    } else {
                        console.log('Please provide an additional private key....');
                    }
                }
            }
        }
    }

    public static isValidPrivateKey(input: string): boolean | string {
        return Convert.isHexString(input, 64) ? true : 'Invalid private key. It must be has 64 hex characters!';
    }

    private async getAccountInfo(repositoryFactory: RepositoryFactory, account: Account): Promise<AccountInfo | undefined> {
        try {
            return await repositoryFactory.createAccountRepository().getAccountInfo(account.address).toPromise();
        } catch (e) {
            return undefined;
        }
    }

    private async getMultisigAccount(repositoryFactory: RepositoryFactory, account: Account): Promise<MultisigAccountInfo | undefined> {
        try {
            const info = await repositoryFactory.createMultisigRepository().getMultisigAccountInfo(account.address).toPromise();
            return info.isMultisig() ? info : undefined;
        } catch (e) {
            return undefined;
        }
    }

    private getKnownNodeRepositoryInfos(knownUrls: string[]): Promise<RepositoryInfo[]> {
        logger.info(`Looking for the best node out of: ${knownUrls.join(', ')}`);
        return Promise.all(
            knownUrls.map(
                async (restGatewayUrl): Promise<RepositoryInfo> => {
                    const repositoryFactory = new RepositoryFactoryHttp(restGatewayUrl);
                    try {
                        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
                        const chainInfo = await repositoryFactory.createChainRepository().getChainInfo().toPromise();
                        return {
                            restGatewayUrl,
                            repositoryFactory,
                            generationHash,
                            chainInfo,
                        };
                    } catch (e) {
                        const message = `There has been an error talking to node ${restGatewayUrl}. Error: ${e.message}}`;
                        logger.warn(message);
                        return {
                            restGatewayUrl: restGatewayUrl,
                            repositoryFactory,
                        };
                    }
                },
            ),
        );
    }

    private sortByHeight(repos: RepositoryInfo[]): RepositoryInfo[] {
        return repos
            .filter((b) => b.chainInfo)
            .sort((a, b) => {
                if (!a.chainInfo) {
                    return 1;
                }
                if (!b.chainInfo) {
                    return -1;
                }
                return b.chainInfo.height.compare(a.chainInfo.height);
            });
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
