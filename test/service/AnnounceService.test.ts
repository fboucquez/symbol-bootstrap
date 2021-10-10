import { expect } from 'chai';
import { of } from 'rxjs';
import { match, restore, spy, stub } from 'sinon';
import {
    Account,
    Address,
    AggregateTransaction,
    Currency,
    Deadline,
    Mosaic,
    MosaicId,
    NetworkType,
    PlainMessage,
    Transaction,
    TransactionService,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';
import {
    AnnounceService,
    BootstrapService,
    CommandUtils,
    ConfigService,
    Preset,
    RemoteNodeService,
    RepositoryInfo,
} from '../../src/service';

describe('Announce Service', () => {
    let announceService: AnnounceService;

    beforeEach(() => {
        announceService = new AnnounceService();
    });

    afterEach(restore);

    const url = 'http://localhost:3000';
    const maxFee = 2_000_000;
    const useKnownRestGateways = false;
    const networkType = NetworkType.TEST_NET;
    const epochAdjustment = 1_616_694_977;
    const networkGenerationHash = '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155';
    const mainPublicKey = '97F7A7D4BBDDE72A892179749C2F12B53C07B86E8FAE048B3E83067FCB63B938';
    const operatingAccount = Account.createFromPrivateKey('6A9A60768C36769C2D756B0CE4DEE3C50CCE2B08A60CFA259289AA4D2706F3C5', networkType);
    const cosigner1 = Account.createFromPrivateKey('41C0163B6A057A4E7B6264AC5BB36C44E0245F8552242BF6A163617C4D616ED3', networkType);
    const cosigner2 = Account.createFromPrivateKey('2FBDC1419F22BC049F6E869B144778277C5930D8D07D55E99ADD2282399FDCF5', networkType);
    const currencyMosaicId = new MosaicId('091F837E059AE13C');
    const password = '1234';

    const singleTransactionFactory = {
        createTransactions(): Promise<Transaction[]> {
            return Promise.resolve([
                TransferTransaction.create(
                    Deadline.create(epochAdjustment),
                    Address.createFromPublicKey(mainPublicKey, networkType),
                    [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
                    PlainMessage.create('This is a transfer transaction.'),
                    networkType,
                    UInt64.fromUint(maxFee),
                    undefined,
                ),
            ]);
        },
    };
    const multipleTransactionFactory = {
        createTransactions(): Promise<Transaction[]> {
            return Promise.resolve([
                TransferTransaction.create(
                    Deadline.create(epochAdjustment),
                    Address.createFromPublicKey(mainPublicKey, networkType),
                    [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
                    PlainMessage.create('Inner tx 1'),
                    networkType,
                    UInt64.fromUint(maxFee),
                    undefined,
                ),
                TransferTransaction.create(
                    Deadline.create(epochAdjustment),
                    Address.createFromPublicKey(mainPublicKey, networkType),
                    [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
                    PlainMessage.create('Inner tx 2'),
                    networkType,
                    UInt64.fromUint(maxFee),
                    undefined,
                ),
            ]);
        },
    };

    const stubCommon = (networkType: NetworkType, epochAdjustment: number, currencyMosaicId: MosaicId, networkGenerationHash: string) => {
        stub(RemoteNodeService.prototype, 'getBestRepositoryInfo').callsFake(() =>
            Promise.resolve(({
                repositoryFactory: {
                    getNetworkType() {
                        return {
                            toPromise() {
                                return Promise.resolve(networkType);
                            },
                        };
                    },
                    createTransactionRepository: stub(),
                    createReceiptRepository: stub(),
                    getEpochAdjustment() {
                        return {
                            toPromise() {
                                return Promise.resolve(epochAdjustment);
                            },
                        };
                    },
                    createListener() {
                        return {
                            open: stub(),
                            close: stub(),
                        };
                    },
                    getCurrencies() {
                        return {
                            toPromise() {
                                return Promise.resolve({
                                    currency: new Currency({
                                        mosaicId: currencyMosaicId,
                                        divisibility: 6,
                                        transferable: true,
                                        supplyMutable: false,
                                        restrictable: false,
                                    }),
                                });
                            },
                        };
                    },
                    createNetworkRepository() {
                        return {
                            getTransactionFees() {
                                return {
                                    toPromise() {
                                        return { minFeeMultiplier: 10 };
                                    },
                                };
                            },
                        };
                    },
                    createChainRepository() {
                        return {
                            getChainInfo() {
                                return {
                                    toPromise() {
                                        return { latestFinalizedBlock: 10 };
                                    },
                                };
                            },
                        };
                    },
                    getGenerationHash() {
                        return {
                            toPromise() {
                                return Promise.resolve(networkGenerationHash);
                            },
                        };
                    },
                },
            } as unknown) as RepositoryInfo),
        );

        stub(announceService, <any>'getAccountInfo').returns(
            Promise.resolve({
                mosaics: [new Mosaic(currencyMosaicId, UInt64.fromUint(100_000_000))],
            }),
        );
    };

    const params = {
        ...ConfigService.defaultParams,
        ready: true,
        target: 'target/tests/testnet-dual',
        password,
        reset: false,
        offline: true,
        preset: Preset.testnet,
        customPresetObject: {
            lastKnownNetworkEpoch: 1,
            nodeUseRemoteAccount: true,
        },
        assembly: 'dual',
    };

    it('Main account regular - Announces simple transaction when single transaction given', async () => {
        const transactionFactory = singleTransactionFactory;

        const { addresses, presetData } = await new BootstrapService().config(params);
        stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

        const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
        const announceSimple = spy(announceService, <any>'announceSimple');
        await announceService.announce(
            url,
            maxFee,
            useKnownRestGateways,
            params.ready,
            params.target,
            presetData,
            addresses,
            transactionFactory,
        );

        expect(announceSimple.called).to.be.true;
        expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: mainPublicKey }), match.any)).to.be.true;
    });

    it('Main account regular- Announces aggregate complete when multiple transactions given', async () => {
        const transactionFactory = multipleTransactionFactory;

        const { addresses, presetData } = await new BootstrapService().config(params);
        stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

        const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
        const announceAggregateComplete = spy(announceService, <any>'announceAggregateComplete');
        await announceService.announce(
            url,
            maxFee,
            useKnownRestGateways,
            params.ready,
            params.target,
            presetData,
            addresses,
            transactionFactory,
        );

        expect(announceAggregateComplete.called).to.be.true;
        expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: mainPublicKey }), match.any)).to.be.true;
    });

    it('Main account multisig - Announces aggregate complete when single transaction and all required cosignatures given', async () => {
        const transactionFactory = multipleTransactionFactory;
        const cosigns = [cosigner1, cosigner2];
        const bestCosigner = cosigner1;

        const { addresses, presetData } = await new BootstrapService().config(params);
        stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

        stub(announceService, <any>'getMultisigAccount').returns(
            Promise.resolve({
                minApproval: 2,
            }),
        );
        stub(announceService, <any>'getMultisigBestCosigner').callsFake((multisigAccountInfo, cosigners: Account[]) => {
            cosigners.push(...cosigns);
            return bestCosigner;
        });
        const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
        const announceAggregateComplete = spy(announceService, <any>'announceAggregateComplete');
        await announceService.announce(
            url,
            maxFee,
            useKnownRestGateways,
            params.ready,
            params.target,
            presetData,
            addresses,
            transactionFactory,
        );

        expect(announceAggregateComplete.called).to.be.true;
        expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
    });

    it('Operating account regular - Announces aggregate bonded', async () => {
        const transactionFactory = multipleTransactionFactory;

        const { addresses, presetData } = await new BootstrapService().config(params);
        stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

        stub(CommandUtils, 'resolvePrivateKey').returns(Promise.resolve(operatingAccount.privateKey));
        const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
        const tsAnnounceBonded = stub(TransactionService.prototype, 'announceAggregateBonded').returns(of({} as AggregateTransaction));
        const announceAggregateBonded = spy(announceService, <any>'announceAggregateBonded');
        const createBonded = spy(AggregateTransaction, 'createBonded');
        await announceService.announce(
            url,
            maxFee,
            useKnownRestGateways,
            params.ready,
            params.target,
            presetData,
            addresses,
            transactionFactory,
            'some',
            operatingAccount.publicKey,
        );

        expect(announceAggregateBonded.called).to.be.true;
        expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: operatingAccount.publicKey }), match.any)).to.be.true;
        expect(tsAnnounceBonded.calledOnceWith(match({ signerPublicKey: operatingAccount.publicKey }), match.any)).to.be.true;
        expect(
            createBonded.calledWith(
                match.any,
                [
                    match({ signer: { publicKey: mainPublicKey } }),
                    match({ signer: { publicKey: mainPublicKey } }),
                    match({ signer: { publicKey: operatingAccount.publicKey } }),
                ],
                match.any,
            ),
        ).to.be.true;
    });

    it('Operating account multisig - Announces aggregate bonded', async () => {
        const transactionFactory = multipleTransactionFactory;
        const cosigns = [cosigner1, cosigner2];
        const bestCosigner = cosigner1;

        const { addresses, presetData } = await new BootstrapService().config(params);
        stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

        stub(announceService, <any>'getMultisigAccount').returns(
            Promise.resolve({
                minApproval: 2,
            }),
        );
        stub(announceService, <any>'getMultisigBestCosigner').callsFake((multisigAccountInfo, cosigners: Account[]) => {
            cosigners.push(...cosigns);
            return bestCosigner;
        });

        stub(CommandUtils, 'resolvePrivateKey').returns(Promise.resolve(bestCosigner.privateKey));
        const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
        const tsAnnounceBonded = stub(TransactionService.prototype, 'announceAggregateBonded').returns(of({} as AggregateTransaction));
        const announceAggregateBonded = spy(announceService, <any>'announceAggregateBonded');
        const createBonded = spy(AggregateTransaction, 'createBonded');
        await announceService.announce(
            url,
            maxFee,
            useKnownRestGateways,
            params.ready,
            params.target,
            presetData,
            addresses,
            transactionFactory,
            'some',
            operatingAccount.publicKey,
        );

        expect(announceAggregateBonded.called).to.be.true;
        expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
        expect(tsAnnounceBonded.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
        expect(
            createBonded.calledWith(
                match.any,
                [
                    match({ signer: { publicKey: mainPublicKey } }),
                    match({ signer: { publicKey: mainPublicKey } }),
                    match({ signer: { publicKey: bestCosigner.publicKey } }),
                ],
                match.any,
            ),
        ).to.be.true;
    });
});
