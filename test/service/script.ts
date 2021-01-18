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
    AggregateTransaction,
    Deadline,
    MultisigAccountModificationTransaction,
    RepositoryFactoryHttp,
    TransactionService,
    UInt64,
} from 'symbol-sdk';

const example = async () => {
    // replace with network type
    const repositoryFactory = new RepositoryFactoryHttp('http://api-01.ap-northeast-1.testnet.symboldev.network:3000');
    const networkType = await repositoryFactory.getNetworkType().toPromise();
    // replace with candidate multisig private key
    const privateKey = 'DDE1C7B19EC2B133523F1DC74FE5765EC772DE64D2DEF695EB50674E10FA7CD1';
    const account = Account.createFromPrivateKey(privateKey, networkType);
    console.log(account.address.plain());
    // replace with cosignatory 1 public key
    const cosignatory1PrivateKey = 'D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332C9778737';
    const cosignatory1 = Account.createFromPrivateKey(cosignatory1PrivateKey, networkType);
    // replace with cosignatory 2 public key
    const cosignatory2PrivateKey = '462EE976890916E54FA825D26BDD0235F5EB5B6A143C199AB0AE5EE9328E08CE';
    const cosignatory2 = Account.createFromPrivateKey(cosignatory2PrivateKey, networkType);

    const epochAdjustment = await repositoryFactory.getEpochAdjustment().toPromise();
    const networkGenerationHash = await repositoryFactory.getGenerationHash().toPromise();
    const multisigAccountModificationTransaction = MultisigAccountModificationTransaction.create(
        Deadline.create(epochAdjustment),
        1,
        1,
        [cosignatory1.address, cosignatory2.address],
        [],
        networkType,
    );

    const aggregateTransaction = AggregateTransaction.createComplete(
        Deadline.create(epochAdjustment),
        [multisigAccountModificationTransaction.toAggregate(account.publicAccount)],
        networkType,
        [],
        UInt64.fromUint(2000000),
    );

    const signedTransaction = account.signTransactionWithCosignatories(
        aggregateTransaction,
        [cosignatory1, cosignatory2],
        networkGenerationHash,
    );
    console.log(signedTransaction.hash);
    const listener = repositoryFactory.createListener();
    await listener.open();
    const service = new TransactionService(repositoryFactory.createTransactionRepository(), repositoryFactory.createReceiptRepository());

    await service.announce(signedTransaction, listener).toPromise();
};

example().then(() => {
    console.log('finish!');
});
