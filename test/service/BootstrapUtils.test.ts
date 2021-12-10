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
import * as _ from 'lodash';
import 'mocha';
import { it } from 'mocha';
import { totalmem } from 'os';
import { Account, NetworkType } from 'symbol-sdk';
import { ConfigurationUtils, LoggerFactory, LogType } from '../../src';
import { ConfigAccount } from '../../src/model';
import { BootstrapUtils, ConfigLoader, CryptoUtils } from '../../src/service';

import { BootstrapUtils, CryptoUtils } from '../../src/service';
import assert = require('assert');
import nock = require('nock');
const logger = LoggerFactory.getLogger(LogType.Silent);
describe('BootstrapUtils', () => {
    it('BootstrapUtils generate random', async () => {
        const networkType = NetworkType.TEST_NET;

        const balances: (ConfigAccount & { balance: number })[] = [];

        for (let i = 0; i < 10; i++) {
            console.log();
            const account = ConfigurationUtils.toConfigAccount(Account.generateNewAccount(networkType));
            balances.push({ ...account, balance: 1000000 });
        }
        console.log(BootstrapUtils.toYaml({ nemesisBalances: balances }));
    });

    it('BootstrapUtils.toAmount', async () => {
        expect(() => BootstrapUtils.toAmount(12345678.9)).to.throw;
        expect(() => BootstrapUtils.toAmount('12345678.9')).to.throw;
        expect(() => BootstrapUtils.toAmount('abc')).to.throw;
        expect(() => BootstrapUtils.toAmount('')).to.throw;
        expect(BootstrapUtils.toAmount(12345678)).to.be.eq("12'345'678");
        expect(BootstrapUtils.toAmount('12345678')).to.be.eq("12'345'678");
        expect(BootstrapUtils.toAmount("12'3456'78")).to.be.eq("12'345'678");
    });

    it('BootstrapUtils.computerMemory', async () => {
        const totalMemory = totalmem();
        expect(totalMemory).to.be.gt(1024 * 1024);
        expect(BootstrapUtils.computerMemory(100)).to.be.eq(totalMemory);
        expect(BootstrapUtils.computerMemory(50)).to.be.eq(totalMemory / 2);
    });

    it('BootstrapUtils.toHex', async () => {
        expect(BootstrapUtils.toHex("5E62990DCAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex("0x5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex('0x5E62990DCAC5BE8A')).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex("5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
    });

    it('BootstrapUtils.loadYaml', async () => {
        expect(CryptoUtils.encryptedCount(BootstrapUtils.loadYaml('test/encrypted.yml', '1234'))).to.be.eq(0);

        try {
            BootstrapUtils.loadYaml('test/encrypted.yml', 'abc');
            expect(1).eq(0);
        } catch (e) {
            expect(e.message).eq('Password is too short. It should have at least 4 characters!');
        }

        try {
            BootstrapUtils.loadYaml('test/encrypted.yml', 'abcd');
            expect(1).eq(0);
        } catch (e) {
            expect(e.message).eq('Cannot decrypt file test/encrypted.yml. Have you used the right password?');
        }

        try {
            BootstrapUtils.loadYaml('test/encrypted.yml', '');
            expect(1).eq(0);
        } catch (e) {
            expect(e.message).eq(
                'File test/encrypted.yml seems to be encrypted but no password has been provided. Have you entered the right password?',
            );
        }

        try {
            BootstrapUtils.loadYaml('test/encrypted.yml', undefined);
            expect(1).eq(0);
        } catch (e) {
            expect(e.message).eq(
                'File test/encrypted.yml seems to be encrypted but no password has been provided. Have you entered the right password?',
            );
        }

        expect(CryptoUtils.encryptedCount(BootstrapUtils.loadYaml('test/encrypted.yml', false))).to.be.eq(6);
    });

    it('mergeTest', async () => {
        const a = { a: 1, list: ['1', '1', '3'], c: 'A', beneficiaryAddress: 'abc' };
        const b = { a: undefined, c: 'B' };
        const c = { list: ['a', 'b'], a: undefined, c: 'C', beneficiaryAddress: '' };
        const expected = {
            a: 1,
            beneficiaryAddress: '',
            c: 'C',
            list: ['a', 'b', '3'],
        };

        expect(_.merge(a, b, c)).deep.equals(expected);

        expect(_.merge(a, b, c)).deep.equals(expected);
    });

    it('should remove null values', () => {
        const compose = {
            version: '2.4',
            services: {
                db: {
                    user: '',
                    environment: {
                        MONGO_INITDB_DATABASE: 'null',
                    },
                    container_name: 'db',
                    image: 'mongo:4.4.3-bionic',
                    command: 'mongod --dbpath=/dbdata --bind_ip=db',
                    stop_signal: 'SIGINT',
                    working_dir: '/docker-entrypoint-initdb.d',
                    ports: [],
                    volumes: ['./mongo:/docker-entrypoint-initdb.d:ro', '../databases/db:/dbdata:rw'],
                    mem_limit: null,
                },
                networks: {
                    default: {
                        ipam: {
                            config: [
                                {
                                    subnet: '172.20.0.0/24',
                                },
                            ],
                        },
                    },
                },
            },
        };

        const composePruned = {
            version: '2.4',
            services: {
                db: {
                    user: '',
                    environment: {
                        MONGO_INITDB_DATABASE: 'null',
                    },
                    container_name: 'db',
                    image: 'mongo:4.4.3-bionic',
                    command: 'mongod --dbpath=/dbdata --bind_ip=db',
                    stop_signal: 'SIGINT',
                    working_dir: '/docker-entrypoint-initdb.d',
                    volumes: ['./mongo:/docker-entrypoint-initdb.d:ro', '../databases/db:/dbdata:rw'],
                },
                networks: {
                    default: {
                        ipam: {
                            config: [
                                {
                                    subnet: '172.20.0.0/24',
                                },
                            ],
                        },
                    },
                },
            },
        };

        expect(BootstrapUtils.pruneEmpty(compose)).to.deep.eq(composePruned);
    });
});
