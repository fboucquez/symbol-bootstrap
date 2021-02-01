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

import { expect } from '@oclif/test';
import 'mocha';
import { Deadline, TransactionType, TransferTransaction, UInt64 } from 'symbol-sdk';
import { BootstrapService, ConfigService, LinkService, Preset } from '../../src/service';
import { SupernodeService, SupernodeServiceTransactionFactoryParams } from '../../src/service/SupernodeService';

const password = '1234';
describe('SupernodeService', () => {
    it('SupernodeService create transactions when supernode', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-supernode',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/supernode.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const nodePreset = presetData.nodes![0];
        const transactionFactoryParams: SupernodeServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodePreset: nodePreset,
            nodeAccount: nodeAccount,
            maxFee: maxFee,
        };

        const transactions = await new SupernodeService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(1);
        const transaction = transactions[0] as TransferTransaction;
        expect(transaction.type).eq(TransactionType.TRANSFER);
        expect(transaction.message.payload).eq(
            'enrol C9767496987222790518114049299DD52114BF2A8F7E5F4B70BB2B6365FAFD34 https://fboucquez-agent-symbollocal.ngrok.io',
        );
    });

    it('Supernode create transactions when dual + voting, not supernode', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const nodePreset = presetData.nodes![0];
        const transactionFactoryParams: SupernodeServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodePreset: nodePreset,
            nodeAccount: nodeAccount,
            maxFee: maxFee,
        };

        const transactions = await new SupernodeService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(0);
    });
});
