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
import { flags } from '@oclif/command';
import { prompt } from 'inquirer';
import { firstValueFrom } from 'rxjs';
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
    MultisigAccountModificationTransaction,
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
import { Logger } from '../logger';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { AccountResolver } from './AccountResolver';
import { CommandUtils } from './CommandUtils';
import { KeyName } from './ConfigService';
import { TransactionUtils } from './TransactionUtils';
import { Utils } from './Utils';

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
    constructor(private readonly logger: Logger, private readonly accountResolver: AccountResolver) {}

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
            this.logger.info(`There are no transactions to announce...`);
            return;
        }
        const url = providedUrl.replace(/\/$/, '');
        const repositoryFactory = await TransactionUtils.getRepositoryFactory(
            this.logger,
            presetData,
            useKnownRestGateways ? undefined : url,
        );
        const networkType = await firstValueFrom(repositoryFactory.getNetworkType());
        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const epochAdjustment = await firstValueFrom(repositoryFactory.getEpochAdjustment());
        const listener = repositoryFactory.createListener();
        await listener.open();
        const faucetUrl = presetData.faucetUrl;
        const currency = (await firstValueFrom(repositoryFactory.getCurrencies())).currency;
        const currencyMosaicId = currency.mosaicId;
        const deadline = Deadline.create(epochAdjustment);
        const minFeeMultiplier = (await firstValueFrom(repositoryFactory.createNetworkRepository().getTransactionFees())).minFeeMultiplier;
        const latestFinalizedBlockEpoch = (await firstValueFrom(repositoryFactory.createChainRepository().getChainInfo()))
            .latestFinalizedBlock.finalizationEpoch;
        if (!currencyMosaicId) {
            throw new Error('Mosaic Id must not be null!');
        }
        if (providedMaxFee) {
            this.logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, currency.divisibility)}`);
        } else {
            this.logger.info(`Node's minFeeMultiplier is ${minFeeMultiplier}`);
        }

        const generationHash = await firstValueFrom(repositoryFactory.getGenerationHash());
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
                this.logger.info(
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
                this.logger.error(
                    `Node signing account ${CommandUtils.formatAccount(announcerPublicAccount)} is not valid. \n\n${noFundsMessage}`,
                );
                continue;
            }
            if (this.isAccountEmpty(announcerAccountInfo, currencyMosaicId)) {
                this.logger.error(
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
                this.logger.info(
                    `Main account ${CommandUtils.formatAccount(mainAccount)} is brand new. There are no records on the chain yet.`,
                );
            }

            const defaultMaxFee = UInt64.fromUint(providedMaxFee || 0);
            const multisigAccountInfo = await TransactionUtils.getMultisigAccount(repositoryFactory, announcerPublicAccount.address);
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
                this.logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
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

                return this.accountResolver.resolveAccount(
                    networkType,
                    nodeAccount.main,
                    KeyName.Main,
                    nodeAccount.name,
                    'signing a transaction',
                    'Should not generate!',
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
                        this.logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    this.logger.info(
                        `Cosigner ${CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`,
                    );
                    signerAccount = bestCosigner; // override with a cosigner when multisig
                    requiredCosignatures = multisigAccountInfo.minApproval;
                } else {
                    signerAccount = await this.accountResolver.resolveAccount(
                        networkType,
                        serviceProviderPublicAccount,
                        KeyName.ServiceProvider,
                        undefined,
                        'signing a transaction',
                        'Should not generate!',
                    );
                }
                const mainMultisigAccountInfo = await TransactionUtils.getMultisigAccount(repositoryFactory, mainAccount.address);
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
                        this.logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    this.logger.info(
                        `Cosigner ${CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`,
                    );
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
                        if (transactions[0].type === TransactionType.MULTISIG_ACCOUNT_MODIFICATION) {
                            const multisigModificationTx = transactions[0] as MultisigAccountModificationTransaction;
                            await this.announceAggregateBonded(
                                signerAccount,
                                () => transactions.map((t) => t.toAggregate(mainAccount)),
                                (multisigModificationTx.addressAdditions || []).length + (multisigModificationTx.minApprovalDelta || 0),
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
                        }
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
            this.logger.info('');
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
                this.logger.info('Please provide the private key....');
            } else {
                const account = Account.createFromPrivateKey(privateKey, networkType);
                const expectedAddress = allowedAddresses.find((address) => address.equals(account.address));
                if (!expectedAddress) {
                    this.logger.info('');
                    this.logger.info(
                        `Invalid private key. The entered private key has this ${account.address.plain()} address and it's not one of ${expectedDescription}. \n`,
                    );
                    this.logger.info(`Please re enter private key...`);
                } else {
                    allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
                    providedAccounts.push(account);
                    if (!allowedAddresses.length) {
                        this.logger.info('All cosigners have been entered.');
                        return providedAccounts;
                    }
                    if (providedAccounts.length == minApproval) {
                        this.logger.info(`Min Approval of ${minApproval} has been reached. Aggregate Complete transaction can be created.`);
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
                        this.logger.info('Please provide an additional private key....');
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
            return await firstValueFrom(repositoryFactory.createAccountRepository().getAccountInfo(mainAccountAddress));
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
                const accountInfo = await firstValueFrom(accountRepository.getAccountInfo(cosigner.address));
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
            this.logger.info(`Announcing ${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)}`);
            await firstValueFrom(transactionService.announce(signedLockFundsTransaction, listener));
            this.logger.info(
                `${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)} has been confirmed`,
            );

            this.logger.info(
                `Announcing Bonded ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`,
            );
            await firstValueFrom(transactionService.announceAggregateBonded(signedAggregateTransaction, listener));
            this.logger.info(
                `${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been announced`,
            );

            this.logger.info('Aggregate Bonded Transaction has been confirmed! Your cosigners would need to cosign!');
        } catch (e) {
            const message =
                `Aggregate Bonded Transaction ${signedAggregateTransaction.type} ${
                    signedAggregateTransaction.hash
                } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + Utils.getMessage(e);
            this.logger.error(message);
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
            this.logger.info(`Announcing ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`);
            await firstValueFrom(transactionService.announce(signedAggregateTransaction, listener));
            this.logger.info(
                `${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been confirmed`,
            );
            return true;
        } catch (e) {
            const message =
                `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${
                    signedAggregateTransaction.hash
                } - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + Utils.getMessage(e);
            this.logger.error(message);
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
            this.logger.info(`Announcing ${this.getTransactionDescription(transaction, signedTransaction, currency)}`);
            await firstValueFrom(transactionService.announce(signedTransaction, listener));
            this.logger.info(`${this.getTransactionDescription(transaction, signedTransaction, currency)} has been confirmed`);
            return true;
        } catch (e) {
            const message =
                `Simple Transaction ${signedTransaction.type} ${signedTransaction.hash} - signer ${signedTransaction
                    .getSignerAddress()
                    .plain()} failed!! ` + Utils.getMessage(e);
            this.logger.error(message);
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
            this.logger.info(`Ignoring transaction for node[${nodeName}]`);
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
        this.logger.info(
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
