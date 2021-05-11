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
import { RewardProgram, RewardProgramService, RewardProgramServiceTransactionFactoryParams } from '../../src/service/RewardProgramService';

const password = '1234';
describe('RewardProgramService', () => {
    it('getRewardProgram', async () => {
        expect(RewardProgramService.getRewardProgram('ecosystem')).eq(RewardProgram.Ecosystem);
        expect(RewardProgramService.getRewardProgram('Ecosystem')).eq(RewardProgram.Ecosystem);
        expect(RewardProgramService.getRewardProgram('superNODE')).eq(RewardProgram.SuperNode);
        expect(RewardProgramService.getRewardProgram('earlyAdoption')).eq(RewardProgram.EarlyAdoption);
        try {
            RewardProgramService.getRewardProgram('NA');
            expect(1).eq(0);
        } catch (e) {
            expect(e.message).eq('NA is not a valid Reward program. Please use one of EarlyAdoption, Ecosystem, SuperNode, MonitorOnly');
        }
    });

    it('RewardProgramService create transactions when supernode', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-supernode',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/unit-test-profiles/supernode.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const nodePreset = presetData.nodes![0];
        const transactionFactoryParams: RewardProgramServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodePreset: nodePreset,
            nodeAccount: nodeAccount,
            maxFee: maxFee,
        };

        const transactions = await new RewardProgramService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(1);
        const transaction = transactions[0] as TransferTransaction;
        expect(transaction.type).eq(TransactionType.TRANSFER);
        expect(transaction.message.payload).eq(
            'enroll https://fboucquez-agent-symbollocal.ngrok.io LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0KTUlHU01FWUNBUUF3RXpFUk1BOEdBMVVFQXd3SVFXZGxiblFnUTBFd0tqQUZCZ01yWlhBRElRQmtJVU1VTjJMSQpKMWcraW1TQW0zM3lkNDRVSlhWdjVkZi95Z0N6eGJVbUc2QUFNQVVHQXl0bGNBTkJBTncyWlIvQUtxUzlSblJWCnMzYWtZcXdHMnAzR0RTREQzVlU3VDFOSk9MWkdiU3g3alY2WnovS2ZzMGgvcEsyRmhvb2taL2oxeUxUQzgxdEkKZzR6MWFnWT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUgUkVRVUVTVC0tLS0tCg==',
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
            customPreset: './test/unit-test-profiles/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const nodePreset = presetData.nodes![0];
        const transactionFactoryParams: RewardProgramServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodePreset: nodePreset,
            nodeAccount: nodeAccount,
            maxFee: maxFee,
        };

        const transactions = await new RewardProgramService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(0);
    });
});
