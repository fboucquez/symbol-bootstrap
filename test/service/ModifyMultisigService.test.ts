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

import { expect } from 'chai';
import { restore, stub } from 'sinon';
import { Account, Deadline, MultisigAccountModificationTransaction, NetworkType, TransactionType, UInt64 } from 'symbol-sdk';
import { LoggerFactory, LogType, Utils } from '../../src';
import { ConfigPreset } from '../../src/model';
import { ModifyMultisigParams, ModifyMultisigService, TransactionFactoryParams, TransactionUtils } from '../../src/service';
import { StdUtils } from '../utils/StdUtils';
const logger = LoggerFactory.getLogger(LogType.Silent);
describe('ModifyMultisigService', () => {
    let modifyMultisigService: ModifyMultisigService;

    afterEach(restore);

    const url = 'http://localhost:3000';
    const target = 'target/tests/testnet-dual';
    const useKnownRestGateways = false;
    const networkType = NetworkType.TEST_NET;
    const maxFee = UInt64.fromUint(2_000_000);
    const mainAccount = Account.createFromPrivateKey('CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD', networkType);
    const presetData = { networkType, useKnownRestGateways } as unknown as ConfigPreset;
    const deadline = Deadline.create(1_616_694_977);

    const cosigner1 = Account.createFromPrivateKey('41C0163B6A057A4E7B6264AC5BB36C44E0245F8552242BF6A163617C4D616ED3', networkType);
    const cosigner2 = Account.createFromPrivateKey('2FBDC1419F22BC049F6E869B144778277C5930D8D07D55E99ADD2282399FDCF5', networkType);

    const commonStub = async (
        addressAdditions?: string,
        addressDeletions?: string,
        minApprovalDelta?: number,
        minRemovalDelta?: number,
        multisigAccount?: any,
    ): Promise<MultisigAccountModificationTransaction> => {
        const params: ModifyMultisigParams = {
            target,
            url,
            useKnownRestGateways,
            addressAdditions,
            addressDeletions,
            minApprovalDelta,
            minRemovalDelta,
        };
        modifyMultisigService = new ModifyMultisigService(logger, params);
        stub(TransactionUtils, <any>'getRepositoryFactory');
        stub(TransactionUtils, <any>'getMultisigAccount').returns(Promise.resolve(multisigAccount));
        const transactionFactoryParams = {
            presetData,
            deadline,
            maxFee,
            mainAccount: mainAccount.publicAccount,
        } as TransactionFactoryParams;
        const transactions = await modifyMultisigService.createTransactions(transactionFactoryParams);
        return transactions[0] as MultisigAccountModificationTransaction;
    };

    it('Converts regular account to multisig, adding single cosignatory', async () => {
        StdUtils.in(['\n']); // for addressDeletions

        const tx = await commonStub(cosigner1.address.plain(), undefined, 1, 1, undefined);

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressAdditions.length).to.be.eq(1);
        expect(tx.addressDeletions.length).to.be.eq(0);
        expect(tx.minRemovalDelta).to.be.eq(1);
        expect(tx.minApprovalDelta).to.be.eq(1);
    });

    it('Converts regular account to multisig, adding multiple cosignatories', async () => {
        StdUtils.in(['\n']); // for addressDeletions

        const tx = await commonStub([cosigner1, cosigner2].map((c) => c.address.plain()).join(','), undefined, 1, 1, undefined);

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressAdditions.length).to.be.eq(2);
        expect(tx.addressDeletions.length).to.be.eq(0);
        expect(tx.minRemovalDelta).to.be.eq(1);
        expect(tx.minApprovalDelta).to.be.eq(1);
    });

    it('Adds another cosignatory to the current multisig account', async () => {
        StdUtils.in(['\n']); // for addressDeletions

        const tx = await commonStub(cosigner2.address.plain(), undefined, 1, 1, {
            minApproval: 1,
            minRemoval: 1,
            cosignatoryAddresses: [cosigner1.address],
        });

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressAdditions.length).to.be.eq(1);
        expect(tx.minRemovalDelta).to.be.eq(1);
        expect(tx.minApprovalDelta).to.be.eq(1);
    });

    it('Removes a cosignatory from the current multisig account', async () => {
        StdUtils.in(['\n']); // for addressAdditions

        const tx = await commonStub(undefined, cosigner1.address.plain(), -1, -1, {
            minApproval: 1,
            minRemoval: 1,
            cosignatoryAddresses: [cosigner1.address],
        });

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressDeletions.length).to.be.eq(1);
        expect(tx.addressAdditions.length).to.be.eq(0);
        expect(tx.minRemovalDelta).to.be.eq(-1);
        expect(tx.minApprovalDelta).to.be.eq(-1);
    });

    it('Modifies minApproval and minRemoval of the current multisig account with prompt for the address additions/deletions', async () => {
        StdUtils.in(['\n', '\n']); // for addressDeletions, addressAdditions

        const tx = await commonStub(undefined, undefined, -1, -1, {
            minApproval: 2,
            minRemoval: 2,
            cosignatoryAddresses: [cosigner1.address],
        });

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressAdditions.length).to.be.eq(0);
        expect(tx.addressDeletions.length).to.be.eq(0);
        expect(tx.minRemovalDelta).to.be.eq(-1);
        expect(tx.minApprovalDelta).to.be.eq(-1);
    });

    it('Modifies minApproval and minRemoval of the current multisig account with no prompts', async () => {
        const tx = await commonStub('', '', -1, -1, {
            minApproval: 2,
            minRemoval: 2,
            cosignatoryAddresses: [cosigner1.address],
        });

        expect(tx.type).to.be.eq(TransactionType.MULTISIG_ACCOUNT_MODIFICATION);
        expect(tx.addressAdditions.length).to.be.eq(0);
        expect(tx.addressDeletions.length).to.be.eq(0);
        expect(tx.minRemovalDelta).to.be.eq(-1);
        expect(tx.minApprovalDelta).to.be.eq(-1);
    });

    it('Throws error when new minApproval is larger than the total number of cosignatories ', async () => {
        StdUtils.in(['\n']); // for addressDeletions

        try {
            await commonStub(cosigner2.address.plain(), undefined, 1, 1, {
                minApproval: 3,
                minRemoval: 1,
                cosignatoryAddresses: [cosigner1.address],
            });
        } catch (err) {
            expect(Utils.getMessage(err)).to.be.eq(
                'There are 2 more required cosignatories than available cosignatories for min. approval. Please add cosignatories or reduce the min. approval delta.',
            );
        }
    });

    it('Throws error when new minRemoval is larger than the total number of cosignatories ', async () => {
        StdUtils.in(['\n']); // for addressDeletions

        try {
            await commonStub(cosigner2.address.plain(), undefined, 1, 1, {
                minApproval: 1,
                minRemoval: 3,
                cosignatoryAddresses: [cosigner1.address],
            });
        } catch (err) {
            expect(Utils.getMessage(err)).to.be.eq(
                'There are 2  more required cosignatories than available cosignatories for min removal. Please add cosignatories or reduce the min. removal delta.',
            );
        }
    });

    it('Throws error when new minApproval is 0 when there are cosignatories in the account', async () => {
        StdUtils.in(['\n', '\n']); // for addressDeletions, addressAdditions

        try {
            await commonStub(undefined, undefined, -1, -1, {
                minApproval: 1,
                minRemoval: 1,
                cosignatoryAddresses: [cosigner1.address],
            });
        } catch (err) {
            expect(Utils.getMessage(err)).to.be.eq(
                'Minimum approval and/or minimum removal cannot be set to 0 while there are 1 cosignatories in your list.',
            );
        }
    });

    it('Throws error while cosignatory to be added already a cosignatory.', async () => {
        StdUtils.in(['\n']); // for addressDeletions, addressAdditions

        try {
            await commonStub(cosigner1.address.plain(), undefined, -1, -1, {
                minApproval: 1,
                minRemoval: 1,
                cosignatoryAddresses: [cosigner1.address],
            });
        } catch (err) {
            expect(Utils.getMessage(err).startsWith('Cannot add cosignatory!')).to.be.true;
        }
    });

    it('Throws error while cosignatory to be removed is not an actual cosignatory.', async () => {
        StdUtils.in(['\n', '\n']); // for addressDeletions, addressAdditions

        try {
            await commonStub(undefined, cosigner2.address.plain(), -1, -1, {
                minApproval: 1,
                minRemoval: 1,
                cosignatoryAddresses: [cosigner1.address],
            });
        } catch (err) {
            expect(Utils.getMessage(err).startsWith('Cannot remove cosignatory!')).to.be.true;
        }
    });
});
