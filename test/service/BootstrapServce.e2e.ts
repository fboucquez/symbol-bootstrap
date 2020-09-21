import 'mocha';
import { BootstrapService, BootstrapUtils, ConfigResult, Preset, StartParams } from '../../src/service';
import { expect } from '@oclif/test';
import {
    Account,
    Deadline,
    NetworkCurrencyLocal,
    PlainMessage,
    RepositoryFactoryHttp,
    TransactionService,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';

describe('BootstrapService', () => {
    async function basicTestNetwork(configResult: ConfigResult): Promise<void> {
        expect(configResult.presetData).not.null;
        expect(configResult.addresses).not.null;
        const repositoryFactory = new RepositoryFactoryHttp('http://localhost:3000');
        const networkType = await repositoryFactory.getNetworkType().toPromise();
        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        expect(configResult.addresses.networkType).eq(networkType);
        expect(configResult.presetData.networkType).eq(networkType);
        expect(configResult.addresses.nemesisGenerationHashSeed).eq(generationHash);
        expect(configResult.presetData.nemesisGenerationHashSeed).eq(generationHash);
        const listener = repositoryFactory.createListener();
        try {
            await listener.open();
            const transactionService = new TransactionService(
                repositoryFactory.createTransactionRepository(),
                repositoryFactory.createReceiptRepository(),
            );

            const nemesisAccounts = configResult.addresses?.mosaics?.['currency'].map((n) => n.privateKey);
            if (!nemesisAccounts) {
                throw new Error('Nemesis accounts could not be loaded!');
            }

            const maxFee = UInt64.fromUint(1000000);
            const account = Account.createFromPrivateKey(nemesisAccounts[0], networkType);

            const recipient = Account.generateNewAccount(networkType);

            const transferTransaction = TransferTransaction.create(
                Deadline.create(),
                recipient.address,
                [NetworkCurrencyLocal.createAbsolute(100)],
                PlainMessage.create('test-message'),
                networkType,
                maxFee,
            );
            const signedTransaction = account.sign(transferTransaction, generationHash);
            console.log('Announcing!!');
            const announcedTransaction = await transactionService.announce(signedTransaction, listener).toPromise();
            console.log('Confirmed!!!');
            expect(announcedTransaction.signer?.address.plain()).eq(account.publicAccount.address.plain());
        } finally {
            if (listener.isOpen()) {
                await listener.close();
            }
            // await service.stop(config);
        }
    }

    it(' bootstrap start', async () => {
        const service = new BootstrapService('.');
        const config: StartParams = {
            preset: Preset.bootstrap,
            reset: true,
            timeout: 60000 * 5,
            target: 'target/bootstrap-test',
            daemon: true,
            user: BootstrapUtils.CURRENT_USER,
        };

        await service.stop(config);
        const configResult = await service.start(config);
        try {
            // Here you can write unit tests against a localhost:3000 network
            await basicTestNetwork(configResult);
        } finally {
            await service.stop(config);
        }
    });

    it(' bootstrap light', async () => {
        const service = new BootstrapService('.');
        const config: StartParams = {
            preset: Preset.light,
            reset: true,
            timeout: 60000 * 5,
            target: 'target/light-test',
            daemon: true,
            user: BootstrapUtils.CURRENT_USER,
        };
        try {
            await service.stop(config);
            const configResult = await service.start(config);
            // Here you can write unit tests against a localhost:3000 network
            await basicTestNetwork(configResult);
        } finally {
            await service.stop(config);
        }
    });
});
