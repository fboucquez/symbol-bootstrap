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
import 'mocha';
import { Account, NetworkType } from 'symbol-sdk';
import { LoggerFactory, LogType } from '../../src/logger';
import { Addresses, PrivateKeySecurityMode } from '../../src/model';
import { BootstrapUtils, ConfigLoader, DefaultAccountResolver, KeyName, Preset } from '../../src/service';

const logger = LoggerFactory.getLogger(LogType.Silent);

const accountResolver = new DefaultAccountResolver();
accountResolver.generateNewAccount = (networkType) => Account.createFromPrivateKey('a'.repeat(64), networkType);
const nodeName = 'node';

describe('ConfigLoader', () => {
    it('ConfigLoader loadPresetData testnet assembly', async () => {
        const configLoader = new ConfigLoader(logger);
        const presetData = await configLoader.createPresetData({
            preset: Preset.testnet,
            assembly: 'dual',
            customPreset: undefined,
            customPresetObject: undefined,
            password: 'abc',
            workingDir: BootstrapUtils.defaultWorkingDir,
        });
        expect(presetData).to.not.be.undefined;
    });

    it('ConfigLoader loadPresetData bootstrap custom', async () => {
        const configLoader = new ConfigLoader(logger);
        const presetData = await configLoader.createPresetData({
            preset: Preset.dualCurrency,
            assembly: undefined,
            customPreset: 'test/override-currency-preset.yml',
            customPresetObject: undefined,
            password: 'abcd',
            workingDir: BootstrapUtils.defaultWorkingDir,
        });
        expect(presetData).to.not.be.undefined;
        expect(presetData?.nemesis?.mosaics?.[0].accounts).to.be.eq(20);
        const yaml = BootstrapUtils.toYaml(presetData);
        expect(BootstrapUtils.fromYaml(yaml)).to.be.deep.eq(presetData);
    });

    it('ConfigLoader loadPresetData bootstrap custom too short!', async () => {
        const configLoader = new ConfigLoader(logger);
        try {
            await configLoader.createPresetData({
                preset: Preset.dualCurrency,
                assembly: undefined,
                customPreset: 'test/override-currency-preset.yml',
                customPresetObject: undefined,
                password: 'abc',
                workingDir: BootstrapUtils.defaultWorkingDir,
            });
        } catch (e) {
            expect(e.message).eq('Password is too short. It should have at least 4 characters!');
        }
    });

    it('applyIndex', async () => {
        const configLoader = new ConfigLoader(logger);
        const context = { $index: 10 };
        expect(configLoader.applyValueTemplate(context, 'hello')).to.be.eq('hello');
        expect(configLoader.applyValueTemplate(context, 'index')).to.be.eq('index');
        expect(configLoader.applyValueTemplate(context, '$index')).to.be.eq('$index');
        expect(configLoader.applyValueTemplate(context, '{{index}}')).to.be.eq('');
        expect(configLoader.applyValueTemplate(context, '{{$index}}')).to.be.eq('10');
        expect(configLoader.applyValueTemplate(context, '{{add $index 2}}')).to.be.eq('12');
        expect(configLoader.applyValueTemplate(context, '100.100.{{add $index 2}}')).to.be.eq('100.100.12');
        expect(configLoader.applyValueTemplate(context, '100.100.{{add $index 5}}')).to.be.eq('100.100.15');
    });

    it('expandServicesRepeat when repeat 3', async () => {
        const configLoader = new ConfigLoader(logger);
        const services = [
            {
                repeat: 3,
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = configLoader.expandServicesRepeat({}, services);

        const expectedExpandedServices = [
            {
                apiNodeName: 'api-node-0',
                apiNodeHost: 'api-node-0',
                apiNodeBrokerHost: 'api-node-broker-0',
                name: 'rest-gateway-0',
                description: 'catapult development network',
                databaseHost: 'db-0',
                openPort: true,
                ipv4_address: '172.20.0.5',
            },
            {
                apiNodeName: 'api-node-1',
                apiNodeHost: 'api-node-1',
                apiNodeBrokerHost: 'api-node-broker-1',
                name: 'rest-gateway-1',
                description: 'catapult development network',
                databaseHost: 'db-1',
                openPort: true,
                ipv4_address: '172.20.0.6',
            },
            {
                apiNodeName: 'api-node-2',
                apiNodeHost: 'api-node-2',
                apiNodeBrokerHost: 'api-node-broker-2',
                name: 'rest-gateway-2',
                description: 'catapult development network',
                databaseHost: 'db-2',
                openPort: true,
                ipv4_address: '172.20.0.7',
            },
        ];
        expect(expandedServices).to.be.deep.eq(expectedExpandedServices);
    });

    it('expandServicesRepeat when repeat 0', async () => {
        const configLoader = new ConfigLoader(logger);
        const services = [
            {
                repeat: 0,
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = configLoader.expandServicesRepeat({}, services);

        expect(expandedServices).to.be.deep.eq([]);
    });

    it('expandServicesRepeat when no repeat', async () => {
        const configLoader = new ConfigLoader(logger);
        const services = [
            {
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = configLoader.expandServicesRepeat({}, services);

        const expectedExpandedServices = [
            {
                apiNodeBrokerHost: 'api-node-broker-0',
                apiNodeHost: 'api-node-0',
                apiNodeName: 'api-node-0',
                databaseHost: 'db-0',
                description: 'catapult development network',
                ipv4_address: '172.20.0.5',
                name: 'rest-gateway-0',
                openPort: true,
            },
        ];
        expect(expandedServices).to.be.deep.eq(expectedExpandedServices);
    });

    it('applyValueTemplate when object', async () => {
        const configLoader = new ConfigLoader(logger);
        const value = {
            _info: 'this file contains a list of api-node peers',
            knownPeers: [
                {
                    publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
                    endpoint: {
                        host: 'api-node-0',
                        port: 7900,
                    },
                    metadata: {
                        name: 'api-node-0',
                        roles: 'Api',
                    },
                },
            ],
        };

        expect(configLoader.applyValueTemplate({}, value)).to.be.deep.eq(value);
        expect(configLoader.applyValueTemplate({}, BootstrapUtils.fromYaml(BootstrapUtils.toYaml(value)))).to.be.deep.eq(value);
    });

    it('applyValueTemplate when array', async () => {
        const configLoader = new ConfigLoader(logger);
        const value = [
            {
                _info: 'this file contains a list of api-node peers',
                knownPeers: [
                    {
                        publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
                        endpoint: {
                            host: 'api-node-0',
                            port: 7900,
                        },
                        metadata: {
                            name: 'api-node-0',
                            roles: 'Api',
                        },
                    },
                ],
            },
        ];

        expect(configLoader.applyValueTemplate({}, value)).to.be.deep.eq(value);
        expect(configLoader.applyValueTemplate({}, BootstrapUtils.fromYaml(BootstrapUtils.toYaml(value)))).to.be.deep.eq(value);
    });

    it('should migrated old addresses', async () => {
        const configLoader = new ConfigLoader(logger);
        const oldAddresses = (await BootstrapUtils.loadYaml('./test/addresses/addresses-old.yml', false)) as Addresses;
        const newAddresses = (await BootstrapUtils.loadYaml('./test/addresses/addresses-new.yml', false)) as Addresses;
        const addresses = configLoader.migrateAddresses(oldAddresses, NetworkType.TEST_NET);
        newAddresses.nodes![1].transport = addresses.nodes![1]!.transport;
        expect(addresses).to.be.deep.eq(newAddresses);
    });

    it('should migrated not migrate new addresses', async () => {
        const configLoader = new ConfigLoader(logger);
        const newAddresses = BootstrapUtils.loadYaml('./test/addresses/addresses-new.yml', false) as Addresses;
        const addresses = configLoader.migrateAddresses(newAddresses, NetworkType.TEST_NET) as Addresses;
        expect(addresses).to.be.deep.eq(newAddresses);
    });

    it('should generateAccount when old and new are different', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = Account.generateNewAccount(networkType);
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            {
                privateKey: newAccount.privateKey,
                address: newAccount.address.plain(),
                publicKey: newAccount.publicKey,
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
            privateKey: newAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are different', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = Account.generateNewAccount(networkType);
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            {
                privateKey: newAccount.privateKey,
                address: newAccount.address.plain(),
                publicKey: newAccount.publicKey,
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
            privateKey: newAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are same', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = oldAccount;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            {
                privateKey: newAccount.privateKey,
                address: newAccount.address.plain(),
                publicKey: newAccount.publicKey,
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
            privateKey: newAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are same, new no private eky', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = oldAccount;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            {
                address: newAccount.address.plain(),
                publicKey: newAccount.publicKey,
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
            privateKey: newAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are same, old no private key', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = oldAccount;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
            },
            {
                privateKey: newAccount.privateKey,
                address: newAccount.address.plain(),
                publicKey: newAccount.publicKey,
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
            privateKey: newAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are same, old private key', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = oldAccount;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
            },
            {
                publicKey: newAccount.publicKey,
                address: newAccount.address.plain(),
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
        });
    });

    it('should generateAccount when old and new are different, no private key new', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const newAccount = Account.generateNewAccount(networkType);
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            {
                publicKey: newAccount.publicKey,
                address: newAccount.address.plain(),
            },
        );
        expect(account).deep.eq({
            publicKey: newAccount.publicKey,
            address: newAccount.address.plain(),
        });
    });

    it('should generateAccount when old and new are different. No new account', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
                privateKey: oldAccount.privateKey,
            },
            undefined,
        );
        expect(account).deep.eq({
            publicKey: oldAccount.publicKey,
            address: oldAccount.address.plain(),
            privateKey: oldAccount.privateKey,
        });
    });

    it('should generateAccount when old and new are different. No new account. Old without private', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const oldAccount = Account.generateNewAccount(networkType);
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            {
                publicKey: oldAccount.publicKey,
                address: oldAccount.address.plain(),
            },
            undefined,
        );
        expect(account).deep.eq({
            publicKey: oldAccount.publicKey,
            address: oldAccount.address.plain(),
        });
    });

    it('should generateAccount brand new', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.ENCRYPT;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Main,
            nodeName,
            undefined,
            undefined,
        );
        expect(account.address).not.undefined;
        expect(account.privateKey).not.undefined;
        expect(account.privateKey).not.undefined;
    });

    it('should generateAccount brand new on remote', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Remote,
            nodeName,
            undefined,
            undefined,
        );
        expect(account.address).not.undefined;
        expect(account.privateKey).not.undefined;
        expect(account.privateKey).not.undefined;
    });

    it('should generateAccount brand new on voting', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.PROMPT_MAIN;
        const account = await configLoader.generateAccount(
            accountResolver,
            networkType,
            securityMode,
            KeyName.Voting,
            nodeName,
            undefined,
            undefined,
        );
        expect(account.address).not.undefined;
        expect(account.privateKey).not.undefined;
        expect(account.privateKey).not.undefined;
    });

    it('should generateAccount raise error new', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.PROMPT_MAIN;

        try {
            await configLoader.generateAccount(accountResolver, networkType, securityMode, KeyName.Main, nodeName, undefined, undefined);
            expect(false).eq(true);
        } catch (e) {
            expect(e.message).eq(
                "Account Main cannot be generated when Private Key Security Mode is PROMPT_MAIN. Account won't be stored anywhere!. Please use ENCRYPT, or provider your Main account with custom presets!",
            );
        }
    });

    it('should generateAccount raise error new', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT;
        expect(
            async () =>
                await configLoader.generateAccount(
                    accountResolver,
                    networkType,
                    securityMode,
                    KeyName.Transport,
                    nodeName,
                    undefined,
                    undefined,
                ),
        ).throw;
    });

    it('should generateAccount raise error new', async () => {
        const configLoader = new ConfigLoader(logger);
        const networkType = NetworkType.TEST_NET;
        const securityMode = PrivateKeySecurityMode.PROMPT_ALL;
        expect(
            async () =>
                await configLoader.generateAccount(
                    accountResolver,
                    networkType,
                    securityMode,
                    KeyName.Remote,
                    nodeName,
                    undefined,
                    undefined,
                ),
        ).throw;
    });
});
