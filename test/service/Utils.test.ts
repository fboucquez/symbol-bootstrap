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

import { expect } from '@oclif/test';
import { it } from 'mocha';
import { Utils } from '../../src';

describe('Utils', () => {
    it('secureString', () => {
        expect(
            Utils.secureString(
                '--secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq('--secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n');

        expect(
            Utils.secureString(
                'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.5 /usr/catapult/bin/catapult.tools.votingkey --secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq(
            'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.5 /usr/catapult/bin/catapult.tools.votingkey --secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
        );
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

        expect(Utils.pruneEmpty(compose)).to.deep.eq(composePruned);
    });
});
