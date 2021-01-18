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
import { combineLatest, EMPTY, from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { Account, RepositoryFactoryHttp, SignedTransaction, Transaction, TransactionService, UInt64 } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { ConfigPreset, NodeAccount } from '../model';
import { BootstrapUtils } from './BootstrapUtils';

const logger: Logger = LoggerFactory.getLogger(LogType.System);
export type TransactionsToAnnounce = { node: NodeAccount; transactions: Transaction[] };

export class AnnounceService {
    public async announce(
        repositoryFactory: RepositoryFactoryHttp,
        presetData: ConfigPreset,
        transactionNodes: TransactionsToAnnounce[],
        generationHash: string,
        tokenAmount = 'some',
    ): Promise<void> {
        if (!transactionNodes.length) {
            logger.info(`There are no transactions to announce...`);
            return;
        }
        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const listener = repositoryFactory.createListener();
        await listener.open();

        const faucetUrl = presetData.faucetUrl;

        const signedTransactionObservable: Observable<SignedTransaction> = from(transactionNodes).pipe(
            mergeMap(({ node, transactions }) => {
                if (!node.main) {
                    throw new Error('CA account is required!');
                }
                const account = Account.createFromPrivateKey(node.main.privateKey, presetData.networkType);
                const noFundsMessage = faucetUrl
                    ? `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${account.address.plain()} via ${faucetUrl}/?recipient=${account.address.plain()}`
                    : `Does your node signing address have any network coin? Send ${tokenAmount} tokens to ${account.address.plain()} .`;

                const accountInfoObservable = repositoryFactory.createAccountRepository().getAccountInfo(account.address);
                const multisigInfoObservable = repositoryFactory
                    .createMultisigRepository()
                    .getMultisigAccountInfo(account.address)
                    .pipe(
                        map((multisigAccount) => {
                            return { multisigAccount: multisigAccount };
                        }),
                        catchError(() => {
                            return of({ multisigAccount: undefined });
                        }),
                    );

                return combineLatest([accountInfoObservable, multisigInfoObservable]).pipe(
                    mergeMap(([a, mutlsigiInfo]) => {
                        const multisigAccount = mutlsigiInfo.multisigAccount;
                        if (multisigAccount) {
                            logger.error(
                                `Node signing account ${multisigAccount.accountAddress.plain()} is a multisig account! This command doesn't support multisig accounts!`,
                            );
                            return EMPTY;
                        }

                        const currencyMosaicIdHex = BootstrapUtils.toHex(presetData.currencyMosaicId);
                        const mosaic = a.mosaics.find((m) => BootstrapUtils.toHex(m.id.toHex()) === currencyMosaicIdHex);
                        if (!mosaic || mosaic.amount.compare(UInt64.fromUint(0)) < 1) {
                            logger.error(
                                `Node signing account ${account.address.plain()} does not have enough currency. Mosaic id: ${currencyMosaicIdHex}. \n\n${noFundsMessage}`,
                            );
                            return EMPTY;
                        }
                        return from(transactions.map((t) => account.sign(t, generationHash)));
                    }),
                    catchError((e) => {
                        logger.error(`Node signing account ${account.address.plain()} is not valid. ${e.message}. \n\n${noFundsMessage}`);
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
