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

import { expect } from 'chai';
import * as _ from 'lodash';
import 'mocha';
import { join } from 'path';
import { Assembly, CustomPreset, LoggerFactory, LogType } from '../../src';
import { ConfigService, CryptoUtils, Preset } from '../../src/service';
// Local test utils
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FileSystemTestUtils } from '../utils/FileSystemTestUtils';

const logger = LoggerFactory.getLogger(LogType.Silent);
describe('ConfigService', () => {
    it('ConfigService bootstrap run with optin_preset.yml', async () => {
        await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            preset: Preset.bootstrap,
            target: 'target/tests/ConfigService.test.optin',
            customPreset: './test/optin_preset.yml',
        }).run();
    });

    it('ConfigService bootstrap in custom preset run with override-currency-preset.yml', async () => {
        await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.test.custom',
            customPreset: './test/override-currency-preset.yml',
        }).run();
    });

    it('ConfigService testnet assembly', async () => {
        await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.test.testnet',
            preset: Preset.testnet,
            assembly: Assembly.dual,
        }).run();
    });

    it('ConfigService mainnet assembly', async () => {
        await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.test.mainnet',
            preset: Preset.mainnet,
            assembly: Assembly.dual,
        }).run();
    });

    it('ConfigService bootstrap default', async () => {
        const configResult = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            password: '1111',
            target: 'target/tests/bootstrap',
            preset: Preset.bootstrap,
        }).run();

        expect(configResult.addresses.mosaics?.length).eq(2);
        expect(configResult.addresses.mosaics?.[0]?.accounts.length).eq(5);
        expect(configResult.addresses.mosaics?.[1]?.accounts.length).eq(2);

        const configResultUpgrade = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            upgrade: true,
            password: '1111',
            target: 'target/tests/bootstrap',
            preset: Preset.bootstrap,
        }).run();
        expect(configResult.addresses).deep.eq(configResultUpgrade.addresses);

        expect(CryptoUtils.removePrivateKeys(configResultUpgrade.presetData)).deep.eq(
            CryptoUtils.removePrivateKeys(configResult.presetData),
        );
    });

    it('ConfigService custom network yml file', async () => {
        const target = 'target/tests/ConfigService.test.customNetwork';
        const workingDir = 'test/customNetwork';
        await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            workingDir: workingDir,
            reset: true,
            password: '1111',
            target: target,
            preset: 'custom-network-preset.yml',
            assembly: Assembly.dual,
        }).run();
        FileSystemTestUtils.assertSameFolder({
            expectFolder: join(workingDir, 'nemesis-seed'),
            actualFolder: join(target, 'nemesis', 'seed'),
        });
    });

    it('ConfigService custom network yml file invalid seed folder', async () => {
        const target = 'target/tests/ConfigService.test.customNetwork';
        const workingDir = 'test/customNetwork';

        try {
            await new ConfigService(logger, {
                ...ConfigService.defaultParams,
                workingDir: workingDir,
                customPresetObject: {
                    nemesisSeedFolder: 'nemesis-seed-invalid',
                },
                reset: true,
                password: '1111',
                target: target,
                preset: 'custom-network-preset.yml',
                assembly: Assembly.dual,
            }).run();
            expect(false).to.be.eq(true); // should have raised an error!
        } catch (e) {
            expect(e.message).eq(`${join('test', `customNetwork`, 'nemesis-seed-invalid')} folder does not exist`);
        }
    });

    it('ConfigService bootstrap repeat', async () => {
        const configResult = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.bootstrap.repeat',
            preset: Preset.bootstrap,
            customPreset: './test/repeat_preset.yml',
        }).run();

        const assertRepeatedService = (expectedCount: number, services: any[] | undefined) => {
            expect(services!.length).to.be.eq(expectedCount);

            services?.forEach((service) => {
                Object.values(service).forEach((value) => {
                    expect((value + '').indexOf('index'), `'${value}' contains index!`).to.be.eq(-1);
                });
            });
        };

        assertRepeatedService(4, configResult.presetData.databases);
        assertRepeatedService(7, configResult.presetData.nodes);
        assertRepeatedService(4, configResult.presetData.gateways);
        assertRepeatedService(4, configResult.presetData.databases);
    });

    it('ConfigService resolve nemesis balances', async () => {
        const customPresetObject: CustomPreset = {
            nodes: [
                {
                    mainPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
                },
            ],
            nemesis: {
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
                mosaics: [
                    {
                        accounts: [
                            '000000000000000000000000000000000000000000000000000000000000000A',
                            '000000000000000000000000000000000000000000000000000000000000000B',
                            '000000000000000000000000000000000000000000000000000000000000000C',
                        ],
                        currencyDistributions: [
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        accounts: ['000000000000000000000000000000000000000000000000000000000000000D'],
                        currencyDistributions: [
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
            },
        };
        const configResult = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.bootstrap.nemesis.balances',
            preset: Preset.bootstrap,
            assembly: Assembly.dual,
            customPresetObject: customPresetObject,
        }).run();
        const presetData = configResult.presetData;
        expect(presetData.nemesis).deep.eq(
            {
                mosaics: [
                    {
                        name: 'currency',
                        divisibility: 6,
                        duration: 0,
                        supply: 8998999998000000,
                        isTransferable: true,
                        isSupplyMutable: false,
                        isRestrictable: false,
                        accounts: [
                            '000000000000000000000000000000000000000000000000000000000000000A',
                            '000000000000000000000000000000000000000000000000000000000000000B',
                            '000000000000000000000000000000000000000000000000000000000000000C',
                        ],
                        currencyDistributions: [
                            {
                                address: 'TDSIJBWRFPA57RLKZQ4OTMLEHYT4L2MMMBSPGWA',
                                amount: 2249749999499994,
                            },
                            {
                                address: 'TCZTFCI4CFLHEB2KZX3GJO2IR6OV6SYUASPLAOA',
                                amount: 2249749999499992,
                            },
                            {
                                address: 'TBRZ247CV76OV6D75JT2KWYPUOEWAGEDBNKNVKQ',
                                amount: 2249749999499992,
                            },
                            {
                                address: 'TB6QOVCUOFRCF5QJSKPIQMLUVWGJS3KYFDETRPA',
                                amount: 2249749999499992,
                            },
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        divisibility: 3,
                        duration: 0,
                        supply: 15000000,
                        isTransferable: true,
                        isSupplyMutable: true,
                        isRestrictable: false,
                        accounts: ['000000000000000000000000000000000000000000000000000000000000000D'],
                        currencyDistributions: [
                            {
                                address: 'TDNLZGEP733XMNHH6Y5KGPSR7A3ZKJ6OF54ZWTQ',
                                amount: 7499700,
                            },
                            {
                                address: 'TB6QOVCUOFRCF5QJSKPIQMLUVWGJS3KYFDETRPA',
                                amount: 7499700,
                            },
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
            },
            `Should be the same than  \n${JSON.stringify(presetData.nemesis, null, 2)}`,
        );

        expect(presetData.nemesis.mosaics.length).eq(2);
        presetData.nemesis.mosaics.forEach((mosaic) => {
            expect(_.sumBy(mosaic.currencyDistributions, (d) => d.amount)).eq(mosaic.supply);
        });

        expect(configResult.addresses.mosaics).deep.eq(
            [
                {
                    id: '113DFC906359F64D',
                    name: 'currency',
                    accounts: [
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000A',
                            address: 'TDSIJBWRFPA57RLKZQ4OTMLEHYT4L2MMMBSPGWA',
                        },
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000B',
                            address: 'TCZTFCI4CFLHEB2KZX3GJO2IR6OV6SYUASPLAOA',
                        },
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000C',
                            address: 'TBRZ247CV76OV6D75JT2KWYPUOEWAGEDBNKNVKQ',
                        },
                    ],
                },
                {
                    id: '0B2720BC49498DAC',
                    name: 'harvest',
                    accounts: [
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000D',
                            address: 'TDNLZGEP733XMNHH6Y5KGPSR7A3ZKJ6OF54ZWTQ',
                        },
                    ],
                },
            ],
            `Should be the same than  \n${JSON.stringify(configResult.addresses.mosaics, null, 2)}`,
        );
    });

    it('ConfigService resolve nemesis balances no extra generated accounts', async () => {
        const customPresetObject: CustomPreset = {
            nodes: [
                {
                    mainPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
                },
            ],
            nemesis: {
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
                mosaics: [
                    {
                        accounts: 0,
                        currencyDistributions: [
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        accounts: 0,
                        currencyDistributions: [
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
            },
        };
        const configResult = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.bootstrap.nemesis.balances.no.extra.gen.accounts',
            preset: Preset.bootstrap,
            assembly: Assembly.dual,
            customPresetObject: customPresetObject,
        }).run();
        const presetData = configResult.presetData;
        expect(presetData.nemesis).deep.eq(
            {
                mosaics: [
                    {
                        name: 'currency',
                        divisibility: 6,
                        duration: 0,
                        supply: 8998999998000000,
                        isTransferable: true,
                        isSupplyMutable: false,
                        isRestrictable: false,
                        accounts: 0,
                        currencyDistributions: [
                            {
                                address: 'TB6QOVCUOFRCF5QJSKPIQMLUVWGJS3KYFDETRPA',
                                amount: 8998999997999970,
                            },
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        divisibility: 3,
                        duration: 0,
                        supply: 15000000,
                        isTransferable: true,
                        isSupplyMutable: true,
                        isRestrictable: false,
                        accounts: 0,
                        currencyDistributions: [
                            {
                                address: 'TB6QOVCUOFRCF5QJSKPIQMLUVWGJS3KYFDETRPA',
                                amount: 14999400,
                            },
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
            },
            `Should be the same than  \n${JSON.stringify(presetData.nemesis, null, 2)}`,
        );

        expect(presetData.nemesis.mosaics.length).eq(2);
        presetData.nemesis.mosaics.forEach((mosaic) => {
            expect(_.sumBy(mosaic.currencyDistributions, (d) => d.amount)).eq(mosaic.supply);
        });

        expect(configResult.addresses.mosaics).deep.eq(
            [
                {
                    id: '113DFC906359F64D',
                    name: 'currency',
                    accounts: [],
                },
                {
                    id: '0B2720BC49498DAC',
                    name: 'harvest',
                    accounts: [],
                },
            ],
            `Should be the same than  \n${JSON.stringify(configResult.addresses.mosaics, null, 2)}`,
        );
    });

    it('ConfigService resolve nemesis balances when excluding the node', async () => {
        const customPresetObject: CustomPreset = {
            nodes: [
                {
                    excludeFromNemesis: true,
                },
            ],
            nemesis: {
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
                mosaics: [
                    {
                        accounts: [
                            '000000000000000000000000000000000000000000000000000000000000000A',
                            '000000000000000000000000000000000000000000000000000000000000000B',
                            '000000000000000000000000000000000000000000000000000000000000000C',
                        ],
                        currencyDistributions: [
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        accounts: ['000000000000000000000000000000000000000000000000000000000000000D'],
                        currencyDistributions: [
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
            },
        };
        const configResult = await new ConfigService(logger, {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/tests/ConfigService.bootstrap.nemesis.balances',
            preset: Preset.bootstrap,
            assembly: Assembly.dual,
            customPresetObject: customPresetObject,
        }).run();
        const presetData = configResult.presetData;
        expect(presetData.nemesis).deep.eq(
            {
                mosaics: [
                    {
                        name: 'currency',
                        divisibility: 6,
                        duration: 0,
                        supply: 8998999998000000,
                        isTransferable: true,
                        isSupplyMutable: false,
                        isRestrictable: false,
                        accounts: [
                            '000000000000000000000000000000000000000000000000000000000000000A',
                            '000000000000000000000000000000000000000000000000000000000000000B',
                            '000000000000000000000000000000000000000000000000000000000000000C',
                        ],
                        currencyDistributions: [
                            {
                                address: 'TDSIJBWRFPA57RLKZQ4OTMLEHYT4L2MMMBSPGWA',
                                amount: 2999666665999990,
                            },
                            {
                                address: 'TCZTFCI4CFLHEB2KZX3GJO2IR6OV6SYUASPLAOA',
                                amount: 2999666665999990,
                            },
                            {
                                address: 'TBRZ247CV76OV6D75JT2KWYPUOEWAGEDBNKNVKQ',
                                amount: 2999666665999990,
                            },
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 10,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 20,
                            },
                        ],
                    },
                    {
                        name: 'harvest',
                        divisibility: 3,
                        duration: 0,
                        supply: 15000000,
                        isTransferable: true,
                        isSupplyMutable: true,
                        isRestrictable: false,
                        accounts: ['000000000000000000000000000000000000000000000000000000000000000D'],
                        currencyDistributions: [
                            {
                                address: 'TDNLZGEP733XMNHH6Y5KGPSR7A3ZKJ6OF54ZWTQ',
                                amount: 14999400,
                            },
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
            },
            `Should be the same than  \n${JSON.stringify(presetData.nemesis, null, 2)}`,
        );

        expect(presetData.nemesis.mosaics.length).eq(2);
        presetData.nemesis.mosaics.forEach((mosaic) => {
            expect(_.sumBy(mosaic.currencyDistributions, (d) => d.amount)).eq(mosaic.supply);
        });

        expect(configResult.addresses.mosaics).deep.eq(
            [
                {
                    id: '113DFC906359F64D',
                    name: 'currency',
                    accounts: [
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000A',
                            address: 'TDSIJBWRFPA57RLKZQ4OTMLEHYT4L2MMMBSPGWA',
                        },
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000B',
                            address: 'TCZTFCI4CFLHEB2KZX3GJO2IR6OV6SYUASPLAOA',
                        },
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000C',
                            address: 'TBRZ247CV76OV6D75JT2KWYPUOEWAGEDBNKNVKQ',
                        },
                    ],
                },
                {
                    id: '0B2720BC49498DAC',
                    name: 'harvest',
                    accounts: [
                        {
                            publicKey: '000000000000000000000000000000000000000000000000000000000000000D',
                            address: 'TDNLZGEP733XMNHH6Y5KGPSR7A3ZKJ6OF54ZWTQ',
                        },
                    ],
                },
            ],
            `Should be the same than  \n${JSON.stringify(configResult.addresses.mosaics, null, 2)}`,
        );
    });

    it('ConfigService invalid nemesis balances, larger than supply', async () => {
        const toKey = (prefix: string, keySize = 64): string => {
            return prefix.padStart(keySize, '0');
        };
        const customPresetObject: CustomPreset = {
            nodes: [
                {
                    mainPrivateKey: toKey('1'),
                },
            ],
            nemesis: {
                nemesisSignerPrivateKey: '935C58E9D933D9A4E3BE6EEB5DA7B518FF90DA6B32BA6BEDE1098B79E2B69B66',
                mosaics: [
                    {
                        supply: 1000000,
                        accounts: [toKey('A'), toKey('B'), toKey('C')],
                        currencyDistributions: [
                            {
                                address: 'TACBGHDQEJOAOAIR4KGWWAOZRGGSR4BPR6JRCPI',
                                amount: 999995,
                            },
                            {
                                address: 'TBJEKGLTINMGFEH6O47E7ZXMZFWZAJHBJTHOVUY',
                                amount: 10,
                            },
                        ],
                    },
                    {
                        supply: 5000000,
                        accounts: [toKey('D')],
                        currencyDistributions: [
                            {
                                address: 'TDSDCOH77Z27YCQ4NPDNC6MMVHXFGIQ7AV4JQSI',
                                amount: 100,
                            },
                            {
                                address: 'TDEOPVFMZW4CEY5OHSGTT3DKTU2JLF2HN57K6AY',
                                amount: 200,
                            },
                            {
                                address: 'TCHX23ENEKTSUGI7MMXFFALNF57C6WXBL7VXM7I',
                                amount: 300,
                            },
                        ],
                    },
                ],
            },
        };

        try {
            await new ConfigService(logger, {
                ...ConfigService.defaultParams,
                reset: true,
                target: 'target/tests/ConfigService.bootstrap.invalid.nemesis.balances',
                preset: Preset.bootstrap,
                assembly: Assembly.dual,
                customPresetObject: customPresetObject,
            }).run();
            expect(false).to.be.eq(true); // should have raised an error!
        } catch (e) {
            expect(e.message).eq("Mosaic currency's fixed distributed supply 1000005 is grater than mosaic total supply 1000000");
        }
    });
});
