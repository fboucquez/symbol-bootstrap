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
import { existsSync } from 'fs';
import 'mocha';
import { it } from 'mocha';
import { totalmem } from 'os';
import { Account, Convert, Crypto, Deadline, NetworkType, UInt64, VotingKeyLinkTransaction, VotingKeyLinkV1Transaction } from 'symbol-sdk';
import { BootstrapUtils } from '../../src/service';
import assert = require('assert');

describe('BootstrapUtils', () => {
    it('BootstrapUtils dockerUserId', async () => {
        const user1 = await BootstrapUtils.getDockerUserGroup();
        const user2 = await BootstrapUtils.getDockerUserGroup();
        const user3 = await BootstrapUtils.getDockerUserGroup();
        assert.strictEqual(user1, user2);
        assert.strictEqual(user1, user3);
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

    it('BootstrapUtils.download', async () => {
        BootstrapUtils.deleteFile('boat.png');
        await BootstrapUtils.download('https://homepages.cae.wisc.edu/~ece533/images/boat.png', 'boat.png');
        await BootstrapUtils.download('https://homepages.cae.wisc.edu/~ece533/images/boat.png', 'boat.png');
        expect(existsSync('boat.png')).eq(true);
    });

    it('Bootstrap.secureText', function () {
        expect(
            BootstrapUtils.secureString(
                '--secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq('--secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n');

        expect(
            BootstrapUtils.secureString(
                'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.4 /usr/catapult/bin/catapult.tools.votingkey --secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq(
            'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.4 /usr/catapult/bin/catapult.tools.votingkey --secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
        );
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

    it('createLongVotingKey', async () => {
        expect(BootstrapUtils.createLongVotingKey('ABC')).to.be.eq(
            'ABC000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        );
        const votingKey = Convert.uint8ToHex(Crypto.randomBytes(48));
        expect(BootstrapUtils.createLongVotingKey(votingKey)).to.be.eq(votingKey);
    });

    it('createVotingKeyTransaction v1 short key', async () => {
        const networkType = NetworkType.PRIVATE;
        const deadline = Deadline.createFromDTO('1');
        const voting = Account.generateNewAccount(networkType);
        const currentHeight = UInt64.fromUint(10);
        const presetData = {
            networkType,
            votingKeyStartEpoch: 1,
            votingKeyEndEpoch: 3,
            votingKeyLinkV2: undefined,
        };
        const maxFee = UInt64.fromUint(20);

        const transaction = BootstrapUtils.createVotingKeyTransaction(
            voting.publicKey,
            currentHeight,
            presetData,
            deadline,
            maxFee,
        ) as VotingKeyLinkTransaction;
        expect(transaction.version).to.be.eq(1);
        expect(transaction.linkedPublicKey).to.be.eq(voting.publicKey);
        expect(transaction.startEpoch).to.be.eq(presetData.votingKeyStartEpoch);
        expect(transaction.endEpoch).to.be.eq(presetData.votingKeyEndEpoch);
        expect(transaction.maxFee).to.be.deep.eq(maxFee);
        expect(transaction.deadline).to.be.deep.eq(deadline);
    });

    it('createVotingKeyTransaction v1 long key', async () => {
        const networkType = NetworkType.PRIVATE;
        const deadline = Deadline.createFromDTO('1');
        const voting = Account.generateNewAccount(networkType);
        const currentHeight = UInt64.fromUint(10);
        const presetData = {
            networkType,
            votingKeyStartEpoch: 1,
            votingKeyEndEpoch: 3,
            votingKeyLinkV2: 30,
        };
        const maxFee = UInt64.fromUint(20);

        const transaction = BootstrapUtils.createVotingKeyTransaction(
            voting.publicKey,
            currentHeight,
            presetData,
            deadline,
            maxFee,
        ) as VotingKeyLinkV1Transaction;
        expect(transaction.version).to.be.eq(1);
        expect(transaction.linkedPublicKey).to.be.eq(BootstrapUtils.createLongVotingKey(voting.publicKey));
        expect(transaction.startEpoch).to.be.eq(presetData.votingKeyStartEpoch);
        expect(transaction.endEpoch).to.be.eq(presetData.votingKeyEndEpoch);
        expect(transaction.maxFee).to.be.deep.eq(maxFee);
        expect(transaction.deadline).to.be.deep.eq(deadline);
    });

    it('createVotingKeyTransaction v2 short key', async () => {
        const networkType = NetworkType.PRIVATE;
        const deadline = Deadline.createFromDTO('1');
        const voting = Account.generateNewAccount(networkType);
        const currentHeight = UInt64.fromUint(40);
        const presetData = {
            networkType,
            votingKeyStartEpoch: 1,
            votingKeyEndEpoch: 3,
            votingKeyLinkV2: 30,
        };
        const maxFee = UInt64.fromUint(20);

        const transaction = BootstrapUtils.createVotingKeyTransaction(
            voting.publicKey,
            currentHeight,
            presetData,
            deadline,
            maxFee,
        ) as VotingKeyLinkTransaction;
        expect(transaction.version).to.be.eq(2);
        expect(transaction.linkedPublicKey).to.be.eq(voting.publicKey);
        expect(transaction.startEpoch).to.be.eq(presetData.votingKeyStartEpoch);
        expect(transaction.endEpoch).to.be.eq(presetData.votingKeyEndEpoch);
        expect(transaction.maxFee).to.be.deep.eq(maxFee);
        expect(transaction.deadline).to.be.deep.eq(deadline);
    });

    it('createVotingKeyTransaction v2 short key when nemesis', async () => {
        const networkType = NetworkType.PRIVATE;
        const deadline = Deadline.createFromDTO('1');
        const voting = Account.generateNewAccount(networkType);
        const currentHeight = UInt64.fromUint(0);
        const presetData = {
            networkType,
            votingKeyStartEpoch: 1,
            votingKeyEndEpoch: 3,
            votingKeyLinkV2: 0,
        };
        const maxFee = UInt64.fromUint(20);

        const transaction = BootstrapUtils.createVotingKeyTransaction(
            voting.publicKey,
            currentHeight,
            presetData,
            deadline,
            maxFee,
        ) as VotingKeyLinkTransaction;
        expect(transaction.version).to.be.eq(2);
        expect(transaction.linkedPublicKey).to.be.eq(voting.publicKey);
        expect(transaction.startEpoch).to.be.eq(presetData.votingKeyStartEpoch);
        expect(transaction.endEpoch).to.be.eq(presetData.votingKeyEndEpoch);
        expect(transaction.maxFee).to.be.deep.eq(maxFee);
        expect(transaction.deadline).to.be.deep.eq(deadline);
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
                    image: 'mongo:4.2.6-bionic',
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
                    image: 'mongo:4.2.6-bionic',
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
