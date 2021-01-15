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
import { DtoMapping, TransactionType, UInt64 } from 'symbol-sdk';
import { BootstrapService, ConfigService, LinkService, Preset } from '../../src/service';
const password = '1234';
describe('LinkService', () => {
    it('LinkService testnet when down', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',

            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
        };
        try {
            await new BootstrapService('.').config(params);
            await new BootstrapService('.').link(params);
        } catch (e) {
            expect(e.message.indexOf('ECONNREFUSED'), `Not a connection error: ${e.message}`).to.be.greaterThan(-1);
        }
    });

    it('LinkService create transactions when dual + voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual-voting',
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
        const epochAdjustment = DtoMapping.parseServerDuration(presetData.epochAdjustment).seconds();
        const height = UInt64.fromUint(10);
        const nodeAndTransactions = await new LinkService(params).createTransactionsToAnnounce(
            epochAdjustment,
            height,
            addresses,
            presetData,
        );
        expect(nodeAndTransactions.length).eq(1);
        expect(nodeAndTransactions[0].node).eq(addresses.nodes?.[0]);
        expect(nodeAndTransactions[0].transactions.length).eq(4);
        expect(nodeAndTransactions[0].transactions[0].type).eq(TransactionType.ACCOUNT_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[1].type).eq(TransactionType.NODE_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[2].type).eq(TransactionType.VRF_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[3].type).eq(TransactionType.VOTING_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[3].version).eq(1);
    });

    it('LinkService create transactions when dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual',
            password,
            reset: true,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const epochAdjustment = DtoMapping.parseServerDuration(presetData.epochAdjustment).seconds();
        const height = UInt64.fromUint(10);
        const nodeAndTransactions = await new LinkService(params).createTransactionsToAnnounce(
            epochAdjustment,
            height,
            addresses,
            presetData,
        );
        expect(nodeAndTransactions.length).eq(1);
        expect(nodeAndTransactions[0].node).eq(addresses.nodes?.[0]);
        expect(nodeAndTransactions[0].transactions.length).eq(3);
        expect(nodeAndTransactions[0].transactions[0].type).eq(TransactionType.ACCOUNT_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[1].type).eq(TransactionType.NODE_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[2].type).eq(TransactionType.VRF_KEY_LINK);
    });

    it('LinkService create transactions when dual not using remote account', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual-not-remote',
            password,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: false,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const epochAdjustment = DtoMapping.parseServerDuration(presetData.epochAdjustment).seconds();
        const height = UInt64.fromUint(10);
        const nodeAndTransactions = await new LinkService(params).createTransactionsToAnnounce(
            epochAdjustment,
            height,
            addresses,
            presetData,
        );
        expect(nodeAndTransactions.length).eq(1);
        expect(nodeAndTransactions[0].node).eq(addresses.nodes?.[0]);
        expect(nodeAndTransactions[0].transactions.length).eq(1);
        expect(nodeAndTransactions[0].transactions[0].type).eq(TransactionType.VRF_KEY_LINK);
    });

    it('LinkService create transactions when api', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-api',
            password,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'api',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const epochAdjustment = DtoMapping.parseServerDuration(presetData.epochAdjustment).seconds();
        const height = UInt64.fromUint(10);
        const nodeAndTransactions = await new LinkService(params).createTransactionsToAnnounce(
            epochAdjustment,
            height,
            addresses,
            presetData,
        );
        expect(nodeAndTransactions.length).eq(0);
    });

    it('LinkService create transactions when api and voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-api-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'api',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const epochAdjustment = DtoMapping.parseServerDuration(presetData.epochAdjustment).seconds();
        const height = UInt64.fromUint(360000);
        const nodeAndTransactions = await new LinkService(params).createTransactionsToAnnounce(
            epochAdjustment,
            height,
            addresses,
            presetData,
        );
        expect(nodeAndTransactions.length).eq(1);
        expect(nodeAndTransactions[0].transactions.length).eq(3);
        expect(nodeAndTransactions[0].transactions[0].type).eq(TransactionType.ACCOUNT_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[1].type).eq(TransactionType.NODE_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[2].type).eq(TransactionType.VOTING_KEY_LINK);
        expect(nodeAndTransactions[0].transactions[2].version).eq(1);
    });
});
