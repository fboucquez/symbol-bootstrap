import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import {
    Account,
    Deadline,
    LinkAction,
    RepositoryFactoryHttp,
    Transaction,
    TransactionService,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { BootstrapUtils } from './BootstrapUtils';
import * as _ from 'lodash';
import { Addresses, ConfigPreset, NodeAccount } from '../model';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { fromArray } from 'rxjs/internal/observable/fromArray';
import { EMPTY, Observable, of } from 'rxjs';

/**
 * params necessary to announce link transactions network.
 */
export type LinkParams = { target: string; url: string; maxFee: number };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class LinkService {
    public static readonly defaultParams: LinkParams = { target: 'target', url: 'http://localhost:3000', maxFee: 100000 };

    constructor(protected readonly params: LinkParams) {}

    public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? BootstrapUtils.loadExistingPresetData(this.params.target);
        const addresses = passedAddresses ?? BootstrapUtils.loadExistingAddresses(this.params.target);

        const url = this.params.url.replace(/\/$/, '');
        logger.info(`Linking nodes using network url ${url}. Max Fee ${this.params.maxFee}`);
        const repositoryFactory = new RepositoryFactoryHttp(url);

        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        if (generationHash !== presetData.nemesisGenerationHashSeed) {
            throw new Error(
                `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`,
            );
        }

        const transactionNodes: { node: NodeAccount; transactions: Transaction[] }[] = _.flatMap(addresses.nodes || []).map((node) => {
            const transactions = [];
            const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
            if (node.voting) {
                const votingPublicKey = BootstrapUtils.createVotingKey(node.voting.publicKey);
                logger.info(
                    `Creating VotingKeyLinkTransaction - node: ${node.name}, signer public key: ${account.publicKey}, voting public key: ${votingPublicKey}`,
                );
                transactions.push(
                    VotingKeyLinkTransaction.create(
                        Deadline.create(),
                        votingPublicKey,
                        1,
                        26280,
                        LinkAction.Link,
                        presetData.networkType,
                        UInt64.fromUint(100000),
                    ),
                );
            }
            logger.info(
                `Creating VrfKeyLinkTransaction - node: ${node.name}, signer public key: ${account.publicKey}, vrf key: ${node.vrf.publicKey}`,
            );
            transactions.push(
                VrfKeyLinkTransaction.create(
                    Deadline.create(),
                    node.vrf.publicKey,
                    LinkAction.Link,
                    presetData.networkType,
                    UInt64.fromUint(100000),
                ),
            );
            return { node, transactions };
        });

        if (!transactionNodes.length) {
            logger.info(`There are no transactions no announce`);
        }

        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const listener = repositoryFactory.createListener();
        await listener.open();

        const faucetUrl = presetData.faucetUrl;

        const signedTransactionObservable = fromArray(transactionNodes).pipe(
            mergeMap(({ node, transactions }) => {
                const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
                const noFundsMessage = faucetUrl
                    ? `Does node signing signing have any network coin? Send some tokens to ${account.address.plain()} via ${faucetUrl}`
                    : `Does node signing signing have any network coin? Send some tokens to ${account.address.plain()} .`;
                return repositoryFactory
                    .createAccountRepository()
                    .getAccountInfo(account.address)
                    .pipe(
                        mergeMap((a) => {
                            const currencyMosaicIdHex = BootstrapUtils.toHex(presetData.currencyMosaicId);
                            const mosaic = a.mosaics.find((m) => BootstrapUtils.toHex(m.id.toHex()) === currencyMosaicIdHex);
                            if (!mosaic || mosaic.amount.compare(UInt64.fromUint(0)) < 1) {
                                logger.error(
                                    `Node signing account ${account.address.plain()} doesn't not have enough currency. Mosaic id: ${currencyMosaicIdHex}. \n\n${noFundsMessage}`,
                                );
                                return EMPTY;
                            }
                            return fromArray(transactions.map((t) => account.sign(t, generationHash)));
                        }),
                        catchError((e) => {
                            logger.error(
                                `Node signing account ${account.address.plain()} is not valid. ${e.message}. \n\n${noFundsMessage}`,
                            );
                            return EMPTY;
                        }),
                    );
            }),
        );

        const announceCalls: Observable<string> = signedTransactionObservable.pipe(
            mergeMap((signedTransaction) => {
                return transactionService.announce(signedTransaction, listener).pipe(
                    map((completedTransaction) => {
                        const message = `Transaction ${completedTransaction.type} ${
                            completedTransaction.transactionInfo?.hash
                        } - signer ${completedTransaction.signer?.address.plain()} has been confirmed`;
                        logger.info(message);
                        return message;
                    }),
                    catchError((e) => {
                        const message =
                            `Transaction ${signedTransaction.type} ${
                                signedTransaction.hash
                            } - signer ${signedTransaction.getSignerAddress().plain()} failed!! ` + e.message;
                        logger.error(message);
                        return of(message);
                    }),
                );
            }),
        );

        await announceCalls.pipe(toArray()).toPromise();

        listener.close();
    }
}
