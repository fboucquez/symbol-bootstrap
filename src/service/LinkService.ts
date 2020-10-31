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

import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import {
    Account,
    Deadline,
    LinkAction,
    NetworkCurrencyPublic,
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
export type LinkParams = { target: string; url: string; maxFee: number; unlink: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class LinkService {
    public static readonly defaultParams: LinkParams = {
        target: BootstrapUtils.defaultTargetFolder,
        url: 'http://localhost:3000',
        maxFee: 100000,
        unlink: false,
    };

    constructor(protected readonly params: LinkParams) {}

    public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? BootstrapUtils.loadExistingPresetData(this.params.target);
        const addresses = passedAddresses ?? BootstrapUtils.loadExistingAddresses(this.params.target);

        const url = this.params.url.replace(/\/$/, '');
        logger.info(
            `${this.params.unlink ? 'Unlinking' : 'Linking'} nodes using network url ${url}. Max Fee ${
                this.params.maxFee / Math.pow(10, NetworkCurrencyPublic.DIVISIBILITY)
            }`,
        );
        const repositoryFactory = new RepositoryFactoryHttp(url);

        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        if (generationHash !== presetData.nemesisGenerationHashSeed) {
            throw new Error(
                `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`,
            );
        }

        const epochAdjustment = await repositoryFactory.getEpochAdjustment().toPromise();
        const transactionNodes = this.createTransactionsToAnnounce(addresses, presetData, epochAdjustment);

        if (!transactionNodes.length) {
            logger.info(`There are no transactions to announce...`);
            return;
        }

        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const listener = repositoryFactory.createListener();
        await listener.open();

        const faucetUrl = presetData.faucetUrl;

        const signedTransactionObservable = fromArray(transactionNodes).pipe(
            mergeMap(({ node, transactions }) => {
                if (!node.signing) {
                    throw new Error('Signing is required!');
                }
                const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
                const noFundsMessage = faucetUrl
                    ? `Does your node signing address have any network coin? Send some tokens to ${account.address.plain()} via ${faucetUrl}`
                    : `Does your node signing address have any network coin? Send some tokens to ${account.address.plain()} .`;
                return repositoryFactory
                    .createAccountRepository()
                    .getAccountInfo(account.address)
                    .pipe(
                        mergeMap((a) => {
                            const currencyMosaicIdHex = BootstrapUtils.toHex(presetData.currencyMosaicId);
                            const mosaic = a.mosaics.find((m) => BootstrapUtils.toHex(m.id.toHex()) === currencyMosaicIdHex);
                            if (!mosaic || mosaic.amount.compare(UInt64.fromUint(0)) < 1) {
                                logger.error(
                                    `Node signing account ${account.address.plain()} does not have enough currency. Mosaic id: ${currencyMosaicIdHex}. \n\n${noFundsMessage}`,
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

    public createTransactionsToAnnounce(
        addresses: Addresses,
        presetData: ConfigPreset,
        epochAdjustment: number,
    ): { node: NodeAccount; transactions: Transaction[] }[] {
        return _.flatMap(addresses.nodes || [])
            .filter((node) => node.signing)
            .map((node) => {
                const transactions = [];
                if (!node.signing) {
                    throw new Error('Signing is required!');
                }
                const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
                const action = this.params.unlink ? LinkAction.Unlink : LinkAction.Link;

                if (node.vrf) {
                    logger.info(
                        `Creating VrfKeyLinkTransaction - node: ${node.name}, signer public key: ${account.publicKey}, vrf key: ${node.vrf.publicKey}`,
                    );
                    transactions.push(
                        VrfKeyLinkTransaction.create(
                            Deadline.create(epochAdjustment),
                            node.vrf.publicKey,
                            action,
                            presetData.networkType,
                            UInt64.fromUint(this.params.maxFee),
                        ),
                    );
                }
                if (node.voting) {
                    const votingPublicKey = BootstrapUtils.createVotingKey(node.voting.publicKey);
                    logger.info(
                        `Creating VotingKeyLinkTransaction - node: ${node.name}, signer public key: ${account.publicKey}, voting public key: ${votingPublicKey}`,
                    );
                    transactions.push(
                        VotingKeyLinkTransaction.create(
                            Deadline.create(epochAdjustment),
                            votingPublicKey,
                            presetData.votingKeyStartEpoch,
                            presetData.votingKeyEndEpoch,
                            action,
                            presetData.networkType,
                            UInt64.fromUint(this.params.maxFee),
                        ),
                    );
                }
                return { node, transactions };
            });
    }
}
