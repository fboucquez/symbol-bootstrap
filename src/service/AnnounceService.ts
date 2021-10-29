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
    Convert,
    Currency,
    Deadline,
    IListener,
    LockFundsTransaction,
    Mosaic,
    MosaicId,
    MultisigAccountInfo,
    NetworkType,
    PlainMessage,
    PublicAccount,
    RepositoryFactory,
    SignedTransaction,
    Transaction,
    TransactionService,
    TransactionType,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { CommandUtils } from './CommandUtils';
import { KeyName } from './ConfigService';
import { RemoteNodeService } from './RemoteNodeService';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export interface TransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    mainAccountInfo?: AccountInfo; // the main account is brand new. It's likely that the service provider account it's being used.
    mainAccount: PublicAccount;
    deadline: Deadline;
    target: string;
    maxFee: UInt64;
    latestFinalizedBlockEpoch: number;
}

export interface TransactionFactory {
    createTransactions(params: TransactionFactoryParams): Promise<Transaction[]>;
}

export class AnnounceService {
    private static onProcessListener = () => {
        process.on('SIGINT', () => {
            process.exit(400);
        });
    };
    public static flags = {
        password: CommandUtils.passwordFlag,
        noPassword: CommandUtils.noPasswordFlag,
        url: flags.string({
            char: 'u',
            description: 'the network url',
            default: 'http://localhost:3000',
        }),
        useKnownRestGateways: flags.boolean({
            description:
                'Use the best NEM node available when announcing. Otherwise the command will use the node provided by the --url parameter.',
        }),
        ready: flags.boolean({
            description: 'If --ready is provided, the command will not ask for confirmation when announcing transactions.',
        }),
        maxFee: flags.integer({
            description: 'the max fee used when announcing (absolute). The node min multiplier will be used if it is not provided.',
        }),
        customPreset: flags.string({
            char: 'c',
            description: `This command uses the encrypted addresses.yml to resolve the main private key. If the main private is only stored in the custom preset, you can provide it using this param. Otherwise, the command may ask for it when required.`,
            required: false,
        }),
        serviceProviderPublicKey: flags.string({
            description:
                'Public key of the service provider account, used when the transaction announcer(service provider account) is different than the main account private key holder',
        }),
    };

    public async announce(
        providedUrl: string,
        providedMaxFee: number | undefined,
        useKnownRestGateways: boolean,
        ready: boolean | undefined,
        target: string,
        presetData: ConfigPreset,
        addresses: Addresses,
        transactionFactory: TransactionFactory,
        tokenAmount = 'some',
        serviceProviderPublicKey?: string,
    ): Promise<void> {
        AnnounceService.onProcessListener();
        if (!presetData.nodes || !presetData.nodes?.length) {
            logger.info(`There are no transactions to announce...`);
            return;
        }
        const url = providedUrl.replace(/\/$/, '');
        const urls = (useKnownRestGateways && presetData.knownRestGateways) || [url];
        const repositoryInfo = await new RemoteNodeService().getBestRepositoryInfo(urls);
        const repositoryFactory = repositoryInfo.repositoryFactory;
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
        const latestFinalizedBlockEpoch = (await repositoryFactory.createChainRepository().getChainInfo().toPromise()).latestFinalizedBlock
            .finalizationEpoch;
        if (!currencyMosaicId) {
            throw new Error('Mosaic Id must not be null!');
        }
        if (providedMaxFee) {
            logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, currency.divisibility)}`);
        } else {
            logger.info(`Node's minFeeMultiplier is ${minFeeMultiplier}`);
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
            const serviceProviderPublicAccount = serviceProviderPublicKey
                ? PublicAccount.createFromPublicKey(serviceProviderPublicKey, presetData.networkType)
                : undefined;
            if (serviceProviderPublicAccount) {
                logger.info(
                    `The Service Provider Account ${CommandUtils.formatAccount(
                        serviceProviderPublicAccount,
                    )} is creating transactions on behalf of your node account ${CommandUtils.formatAccount(mainAccount)}.`,
                );
            }
            const announcerPublicAccount = serviceProviderPublicAccount ? serviceProviderPublicAccount : mainAccount;
            const noFundsMessage = faucetUrl
                ? `Your account does not have enough XYM to complete this transaction. Send ${tokenAmount} tokens to ${announcerPublicAccount.address.plain()} via ${faucetUrl}/?recipient=${announcerPublicAccount.address.plain()}`
                : `Your account does not have enough XYM to complete this transaction. Send ${tokenAmount} tokens to ${announcerPublicAccount.address.plain()} .`;
            const announcerAccountInfo = await this.getAccountInfo(repositoryFactory, announcerPublicAccount.address);

            if (!announcerAccountInfo) {
                logger.error(
                    `Node signing account ${CommandUtils.formatAccount(announcerPublicAccount)} is not valid. \n\n${noFundsMessage}`,
                );
                continue;
            }
            if (this.isAccountEmpty(announcerAccountInfo, currencyMosaicId)) {
                logger.error(
                    `Node signing account ${CommandUtils.formatAccount(
                        announcerPublicAccount,
                    )} does not have enough currency. Mosaic id: ${currencyMosaicId}. \n\n${noFundsMessage}`,
                );
                continue;
            }

            const mainAccountInfo = mainAccount.address.equals(announcerPublicAccount.address)
                ? announcerAccountInfo
                : await this.getAccountInfo(repositoryFactory, mainAccount.address);
            if (!mainAccountInfo) {
                logger.info(`Main account ${CommandUtils.formatAccount(mainAccount)} is brand new. There are no records on the chain yet.`);
            }

            const defaultMaxFee = UInt64.fromUint(providedMaxFee || 0);
            const multisigAccountInfo = await this.getMultisigAccount(repositoryFactory, announcerPublicAccount.address);
            const params: TransactionFactoryParams = {
                presetData,
                nodePreset,
                nodeAccount,
                mainAccountInfo,
                latestFinalizedBlockEpoch,
                target,
                mainAccount: announcerPublicAccount,
                deadline,
                maxFee: defaultMaxFee,
            };
            const transactions = await transactionFactory.createTransactions(params);
            if (!transactions.length) {
                logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
                continue;
            }

            const resolveMainAccount = async (): Promise<Account> => {
                const presetMainPrivateKey = (presetData.nodes || [])[index]?.mainPrivateKey;
                if (presetMainPrivateKey) {
                    const account = Account.createFromPrivateKey(presetMainPrivateKey, networkType);
                    if (account.address.equals(announcerPublicAccount.address)) {
                        return account;
                    }
                }

                return Account.createFromPrivateKey(
                    await CommandUtils.resolvePrivateKey(
                        networkType,
                        nodeAccount.main,
                        KeyName.Main,
                        nodeAccount.name,
                        'signing a transaction',
                    ),
                    networkType,
                );
            };

            const cosigners: Account[] = [];

            if (serviceProviderPublicAccount) {
                let signerAccount: Account;
                let requiredCosignatures = 1; // for mainAccount
                if (multisigAccountInfo) {
                    const bestCosigner = await this.getMultisigBestCosigner(
                        multisigAccountInfo,
                        cosigners,
                        'Service provider account',
                        networkType,
                        repositoryFactory,
                        currencyMosaicId,
                    );
                    if (!bestCosigner) {
                        logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    logger.info(`Cosigner ${CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`);
                    signerAccount = bestCosigner; // override with a cosigner when multisig
                    requiredCosignatures = multisigAccountInfo.minApproval;
                } else {
                    // ask for serviceProviderAccount private key
                    signerAccount = Account.createFromPrivateKey(
                        await CommandUtils.resolvePrivateKey(
                            networkType,
                            serviceProviderPublicAccount,
                            KeyName.ServiceProvider,
                            '',
                            'signing a transaction',
                        ),
                        networkType,
                    );
                }
                const mainMultisigAccountInfo = await this.getMultisigAccount(repositoryFactory, mainAccount.address);
                requiredCosignatures += mainMultisigAccountInfo?.minApproval || 0; // mainAccount.minApproval

                const zeroAmountInnerTransaction = (account: PublicAccount): Transaction =>
                    TransferTransaction.create(
                        deadline,
                        account.address, // self transfer
                        [new Mosaic(currencyMosaicId, UInt64.fromUint(0))], // zero amount
                        PlainMessage.create(''),
                        networkType,
                        defaultMaxFee,
                    ).toAggregate(account);

                await this.announceAggregateBonded(
                    signerAccount,
                    () => [
                        ...transactions.map((t) => t.toAggregate(mainAccount)),
                        zeroAmountInnerTransaction(serviceProviderPublicAccount),
                    ],
                    requiredCosignatures,
                    deadline,
                    networkType,
                    defaultMaxFee,
                    providedMaxFee,
                    minFeeMultiplier,
                    cosigners,
                    generationHash,
                    currency,
                    transactionService,
                    listener,
                    ready,
                    nodeAccount.name,
                );
            } else {
                if (multisigAccountInfo) {
                    const bestCosigner = await this.getMultisigBestCosigner(
                        multisigAccountInfo,
                        cosigners,
                        `The node's main account`,
                        networkType,
                        repositoryFactory,
                        currencyMosaicId,
                    );
                    if (!bestCosigner) {
                        logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    logger.info(`Cosigner ${CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`);
                    if (cosigners.length >= multisigAccountInfo.minApproval) {
                        //agg complete
                        await this.announceAggregateComplete(
                            bestCosigner,
                            () => transactions.map((t) => t.toAggregate(mainAccount)),
                            deadline,
                            networkType,
                            defaultMaxFee,
                            providedMaxFee,
                            minFeeMultiplier,
                            generationHash,
                            currency,
                            transactionService,
                            listener,
                            ready,
                            nodeAccount.name,
                            cosigners.length - 1,
                            cosigners,
                        );
                    } else {
                        //agg bonded
                        await this.announceAggregateBonded(
                            bestCosigner,
                            () => transactions.map((t) => t.toAggregate(mainAccount)),
                            multisigAccountInfo.minApproval,
                            deadline,
                            networkType,
                            defaultMaxFee,
                            providedMaxFee,
                            minFeeMultiplier,
                            cosigners,
                            generationHash,
                            currency,
                            transactionService,
                            listener,
                            ready,
                            nodeAccount.name,
                        );
                    }
                } else {
                    const signerAccount = await resolveMainAccount();
                    if (transactions.length == 1) {
                        await this.announceSimple(
                            signerAccount,
                            transactions[0],
                            providedMaxFee,
                            minFeeMultiplier,
                            generationHash,
                            currency,
                            transactionService,
                            listener,
                            ready,
                            nodeAccount.name,
                        );
                    } else {
                        await this.announceAggregateComplete(
                            signerAccount,
                            () => transactions.map((t) => t.toAggregate(mainAccount)),
                            deadline,
                            networkType,
                            defaultMaxFee,
                            providedMaxFee,
                            minFeeMultiplier,
                            generationHash,
                            currency,
                            transactionService,
                            listener,
                            ready,
                            nodeAccount.name,
                            0,
                        );
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

    private async announceAggregateBonded(
        signerAccount: Account,
        transactionFactory: () => Transaction[],
        requiredCosignatures: number,
        deadline: Deadline,
        networkType: NetworkType,
        defaultMaxFee: UInt64,
        providedMaxFee: number | undefined,
        minFeeMultiplier: number,
        cosigners: Account[],
        generationHash: string,
        currency: Currency,
        transactionService: TransactionService,
        listener: IListener,
        ready: boolean | undefined,
        nodeName: string,
    ): Promise<boolean> {
        let aggregateTransaction = AggregateTransaction.createBonded(deadline, transactionFactory(), networkType, [], defaultMaxFee);
        if (!providedMaxFee) {
            aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, requiredCosignatures);
        }
        const signedAggregateTransaction = signerAccount.signTransactionWithCosignatories(
            aggregateTransaction,
            cosigners.filter((a) => a !== signerAccount),
            generationHash,
        );
        let lockFundsTransaction: Transaction = LockFundsTransaction.create(
            deadline,
            currency.createRelative(10),
            UInt64.fromUint(5760),
            signedAggregateTransaction,
            networkType,
            defaultMaxFee,
        );
        if (!providedMaxFee) {
            lockFundsTransaction = lockFundsTransaction.setMaxFee(minFeeMultiplier);
        }
        const signedLockFundsTransaction = signerAccount.sign(lockFundsTransaction, generationHash);
        if (!(await this.shouldAnnounce(lockFundsTransaction, signedLockFundsTransaction, ready, currency, nodeName))) {
            return false;
        }
        if (!(await this.shouldAnnounce(aggregateTransaction, signedAggregateTransaction, ready, currency, nodeName))) {
            return false;
        }

        try {
            logger.info(`Announcing ${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)}`);
            await transactionService.announce(signedLockFundsTransaction, listener).toPromise();
            logger.info(`${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)} has been confirmed`);

            logger.info(`Announcing Bonded ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`);
            await transactionService.announceAggregateBonded(signedAggregateTransaction, listener).toPromise();
            logger.info(`${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been announced`);

            logger.info('Aggregate Bonded Transaction has been confirmed! Your cosigners would need to cosign!');
        } catch (e) {
            const message =
                `Aggregate Bonded Transaction ${signedAggregateTransaction.type} ${
                    signedAggregateTransaction.hash
                } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
            logger.error(message);
            return false;
        }
        return true;
    }

    private async announceAggregateComplete(
        signer: Account,
        transactionFactory: () => Transaction[],
        deadline: Deadline,
        networkType: NetworkType,
        defaultMaxFee: UInt64,
        providedMaxFee: number | undefined,
        minFeeMultiplier: number,
        generationHash: string,
        currency: Currency,
        transactionService: TransactionService,
        listener: IListener,
        ready: boolean | undefined,
        nodeName: string,
        requiredCosignatures?: number,
        cosigners?: Account[],
    ): Promise<boolean> {
        let aggregateTransaction = AggregateTransaction.createComplete(deadline, transactionFactory(), networkType, [], defaultMaxFee);
        if (!providedMaxFee) {
            aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, requiredCosignatures || 0);
        }
        const signedAggregateTransaction = cosigners
            ? signer.signTransactionWithCosignatories(
                  aggregateTransaction,
                  cosigners.filter((a) => a !== signer),
                  generationHash,
              )
            : signer.sign(aggregateTransaction, generationHash);
        if (!(await this.shouldAnnounce(aggregateTransaction, signedAggregateTransaction, ready, currency, nodeName))) {
            return false;
        }
        try {
            logger.info(`Announcing ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`);
            await transactionService.announce(signedAggregateTransaction, listener).toPromise();
            logger.info(`${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been confirmed`);
            return true;
        } catch (e) {
            const message =
                `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                    signedAggregateTransaction.hash
                } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + e.message;
            logger.error(message);
            return false;
        }
    }

    private async announceSimple(
        signer: Account,
        transaction: Transaction,
        providedMaxFee: number | undefined,
        minFeeMultiplier: number,
        generationHash: string,
        currency: Currency,
        transactionService: TransactionService,
        listener: IListener,
        ready: boolean | undefined,
        nodeName: string,
    ): Promise<boolean> {
        if (!providedMaxFee) {
            transaction = transaction.setMaxFee(minFeeMultiplier);
        }
        const signedTransaction = signer.sign(transaction, generationHash);
        if (!(await this.shouldAnnounce(transaction, signedTransaction, ready, currency, nodeName))) {
            return false;
        }
        try {
            logger.info(`Announcing ${this.getTransactionDescription(transaction, signedTransaction, currency)}`);
            await transactionService.announce(signedTransaction, listener).toPromise();
            logger.info(`${this.getTransactionDescription(transaction, signedTransaction, currency)} has been confirmed`);
            return true;
        } catch (e) {
            const message =
                `Simple Transaction ${signedTransaction.type} ${
                    signedTransaction.hash
                } - signer ${signedTransaction.getSignerAddress().plain()} failed!! ` + e.message;
            logger.error(message);
            return false;
        }
    }

    private getTransactionDescription(transaction: Transaction, signedTransaction: SignedTransaction, currency: Currency): string {
        const aggTypeDescription = (type: TransactionType) => {
            switch (type) {
                case TransactionType.AGGREGATE_BONDED:
                    return '(Bonded)';
                case TransactionType.AGGREGATE_COMPLETE:
                    return '(Complete)';
                default:
                    return '';
            }
        };
        return `${transaction.constructor.name + aggTypeDescription(transaction.type)} - Hash: ${signedTransaction.hash} - MaxFee ${
            transaction.maxFee.compact() / Math.pow(10, currency.divisibility)
        }`;
    }

    public async shouldAnnounce(
        transaction: Transaction,
        signedTransaction: SignedTransaction,
        ready: boolean | undefined,
        currency: Currency,
        nodeName: string,
    ): Promise<boolean> {
        const response: boolean =
            ready ||
            (
                await prompt([
                    {
                        name: 'value',
                        message: `Do you want to announce ${this.getTransactionDescription(transaction, signedTransaction, currency)}?`,
                        type: 'confirm',
                        default: true,
                    },
                ])
            ).value;
        if (!response) {
            logger.info(`Ignoring transaction for node[${nodeName}]`);
        }
        return response;
    }

    private async getMultisigBestCosigner(
        msigAccountInfo: MultisigAccountInfo,
        cosigners: Account[],
        accountName: string,
        networkType: NetworkType,
        repositoryFactory: RepositoryFactory,
        currencyMosaicId: MosaicId | undefined,
    ): Promise<Account | undefined> {
        logger.info(
            `${accountName} is a multisig account with Address: ${
                msigAccountInfo.minApproval
            } min approval. Cosigners are: ${msigAccountInfo.cosignatoryAddresses
                .map((a) => a.plain())
                .join(
                    ', ',
                )}. The tool will ask for the cosigners provide keys in order to announce the transactions. These private keys are not stored anywhere!`,
        );
        cosigners.push(...(await this.promptAccounts(networkType, msigAccountInfo.cosignatoryAddresses, msigAccountInfo.minApproval)));
        if (!cosigners.length) {
            return undefined;
        }
        return await this.getBestCosigner(repositoryFactory, cosigners, currencyMosaicId);
    }
}
