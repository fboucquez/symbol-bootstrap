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
    RawMessage,
    RepositoryFactoryHttp,
    TransactionService,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';

const example = async () => {
    const repositoryFactory = new RepositoryFactoryHttp('http://api-01.ap-northeast-1.testnet.symboldev.network:3000');
    const listener = repositoryFactory.createListener();
    const networkType = await repositoryFactory.getNetworkType().toPromise();
    const epochAdjustment = await repositoryFactory.getEpochAdjustment().toPromise();
    const networkGenerationHash = await repositoryFactory.getGenerationHash().toPromise();
    const currency = (await repositoryFactory.getCurrencies().toPromise()).currency;
    const deadline = Deadline.create(epochAdjustment);
    const maxFee = UInt64.fromUint(2000000);
    const service = new TransactionService(repositoryFactory.createTransactionRepository(), repositoryFactory.createReceiptRepository());

    const sendModification = async (cosignatory1: Account, cosignatory2: Account, cosignatory3: Account, account: Account) => {
        const multisigAccountModificationTransaction = MultisigAccountModificationTransaction.create(
            deadline,
            2,
            2,
            [cosignatory2.address, cosignatory2.address, cosignatory3.address],
            [],
            networkType,
        );

        const aggregateTransaction = AggregateTransaction.createComplete(
            deadline,
            [multisigAccountModificationTransaction.toAggregate(account.publicAccount)],
            networkType,
            [],
            maxFee,
        );

        const signedTransaction = account.signTransactionWithCosignatories(
            aggregateTransaction,
            [cosignatory1, cosignatory2, cosignatory3],
            networkGenerationHash,
        );
        await service.announce(signedTransaction, listener).toPromise();
        return signedTransaction;
    };

    const sendTransfer = async (cosignatory1: Account, cosignatory2: Account, cosignatory3: Account, account: Account) => {
        const transferTransaction = TransferTransaction.create(
            deadline,
            cosignatory1.address,
            [currency.createAbsolute(1)],
            new RawMessage(),
            networkType,
            maxFee,
        );

        const aggregateTransaction = AggregateTransaction.createComplete(
            deadline,
            [transferTransaction.toAggregate(account.publicAccount)],
            networkType,
            [],
            maxFee,
        );

        const signedTransaction = cosignatory1.signTransactionWithCosignatories(
            aggregateTransaction,
            [cosignatory2, cosignatory3],
            networkGenerationHash,
        );
        await service.announce(signedTransaction, listener).toPromise();
        return signedTransaction;
    };

    try {
        // replace with network type

        await listener.open();
        // replace with candidate multisig private key
        const privateKey = 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD';
        const account = Account.createFromPrivateKey(privateKey, networkType);
        console.log(`Mutlsig: ${account.address.plain()}`);

        // replace with cosignatory 1 public key
        const cosignatory1PrivateKey = 'AAAAB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332C9778737';
        const cosignatory1 = Account.createFromPrivateKey(cosignatory1PrivateKey, networkType);
        console.log(`cosignatory1 ${cosignatory1.address.plain()}`);

        // replace with cosignatory 2 public key
        const cosignatory2PrivateKey = 'BBBEE976890916E54FA825D26BDD0235F5EB5B6A143C199AB0AE5EE9328E08CE';
        const cosignatory2 = Account.createFromPrivateKey(cosignatory2PrivateKey, networkType);
        console.log(`cosignatory2 ${cosignatory2.address.plain()}`);

        // replace with cosignatory 2 public key
        const cosignatory3PrivateKey = 'CCCEE976890916E54FA825D26BDD0235F5EB5B6A143C199AB0AE5EE9328E08EE';
        const cosignatory3 = Account.createFromPrivateKey(cosignatory3PrivateKey, networkType);
        console.log(`cosignatory3 ${cosignatory3.address.plain()}`);

        await sendTransfer(cosignatory1, cosignatory2, cosignatory3, account);
    } finally {
        listener.close();
    }
};

example().then(() => {
    console.log('finish!');
});
