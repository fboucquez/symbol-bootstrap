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
import { existsSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import { Account, Address, MosaicId, MosaicNonce, NetworkType } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigAccount, ConfigPreset, MosaicAccounts, NodeAccount, NodePreset } from '../model';
import { BootstrapUtils, Migration, Password } from './BootstrapUtils';
import { Preset } from './ConfigService';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ConfigLoader {
    private static presetInfoLogged = false;

    public async generateRandomConfiguration(presetData: ConfigPreset): Promise<Addresses> {
        const networkType = presetData.networkType;
        const addresses: Addresses = {
            version: this.getAddressesMigration(presetData.networkType).length + 1,
            networkType: networkType,
            nemesisGenerationHashSeed:
                presetData.nemesisGenerationHashSeed || Account.generateNewAccount(networkType).publicAccount.publicKey,
        };

        if (presetData.nodes) {
            addresses.nodes = await this.generateNodeAccounts(presetData, networkType);
        }

        const sinkAddress = Account.generateNewAccount(networkType).address.plain();

        if (!presetData.harvestNetworkFeeSinkAddress) {
            presetData.harvestNetworkFeeSinkAddress = sinkAddress;
        }
        if (!presetData.mosaicRentalFeeSinkAddress) {
            presetData.mosaicRentalFeeSinkAddress = sinkAddress;
        }
        if (!presetData.namespaceRentalFeeSinkAddress) {
            presetData.namespaceRentalFeeSinkAddress = sinkAddress;
        }

        presetData.networkIdentifier = BootstrapUtils.getNetworkIdentifier(presetData.networkType);
        presetData.networkName = BootstrapUtils.getNetworkName(presetData.networkType);
        if (!presetData.nemesisGenerationHashSeed) {
            presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        }

        if (presetData.nemesis) {
            addresses.nemesisSigner = ConfigLoader.toConfig(this.generateAccount(networkType, presetData.nemesis.nemesisSignerPrivateKey));
            if (!presetData.nemesis.nemesisSignerPrivateKey && addresses.nemesisSigner) {
                presetData.nemesis.nemesisSignerPrivateKey = addresses.nemesisSigner.privateKey;
            }
        }

        if (!presetData.nemesisSignerPublicKey && addresses.nemesisSigner) {
            presetData.nemesisSignerPublicKey = addresses.nemesisSigner.publicKey;
        }

        const nemesisSignerAddress = Address.createFromPublicKey(presetData.nemesisSignerPublicKey, networkType);

        if (!presetData.currencyMosaicId)
            presetData.currencyMosaicId = BootstrapUtils.toHex(
                MosaicId.createFromNonce(MosaicNonce.createFromNumber(0), nemesisSignerAddress).toHex(),
            );
        if (!presetData.harvestingMosaicId) {
            if (!presetData.nemesis) {
                throw new Error('nemesis must be defined!');
            }
            if (presetData.nemesis.mosaics && presetData.nemesis.mosaics.length > 1) {
                presetData.harvestingMosaicId = BootstrapUtils.toHex(
                    MosaicId.createFromNonce(MosaicNonce.createFromNumber(1), nemesisSignerAddress).toHex(),
                );
            } else {
                presetData.harvestingMosaicId = presetData.currencyMosaicId;
            }
        }

        if (presetData.nemesis) {
            if (presetData.nemesis.mosaics) {
                const mosaics: MosaicAccounts[] = [];
                presetData.nemesis.mosaics.forEach((m, index) => {
                    const accounts = this.generateAddresses(networkType, m.accounts);
                    mosaics.push({
                        id: index ? presetData.currencyMosaicId : presetData.harvestingMosaicId,
                        name: m.name,
                        type: index ? 'harvest' : 'currency',
                        accounts,
                    });
                });

                presetData.nemesis.mosaics.forEach((m, index) => {
                    const accounts = mosaics[index].accounts;
                    if (!m.currencyDistributions) {
                        const caNodes = (addresses.nodes || []).filter((node) => node.main);
                        const totalAccounts = (m.accounts || 0) + caNodes.length;
                        const amountPerAccount = Math.floor(m.supply / totalAccounts);
                        m.currencyDistributions = [
                            ...accounts.map((a) => ({ address: a.address, amount: amountPerAccount })),
                            ...caNodes.map((n) => ({ address: n.main!.address, amount: amountPerAccount })),
                        ];
                        if (m.currencyDistributions.length)
                            m.currencyDistributions[0].amount += m.supply - totalAccounts * amountPerAccount;
                    }
                    const supplied = m.currencyDistributions.map((d) => d.amount).reduce((a, b) => a + b, 0);
                    if (m.supply != supplied) {
                        throw new Error(`Invalid nemgen total supplied value, expected ${m.supply} but total is ${supplied}`);
                    }
                });
                addresses.mosaics = mosaics;
            }
        }

        return addresses;
    }

    public generateAddresses(networkType: NetworkType, size: number): ConfigAccount[] {
        return ConfigLoader.getArray(size).map(() => ConfigLoader.toConfig(Account.generateNewAccount(networkType)));
    }

    public generateAccount(networkType: NetworkType, privateKey: string | undefined): Account {
        return privateKey ? Account.createFromPrivateKey(privateKey, networkType) : Account.generateNewAccount(networkType);
    }

    public generateNodeAccount(presetData: ConfigPreset, index: number, nodePreset: NodePreset, networkType: NetworkType): NodeAccount {
        const name = nodePreset.name || `node-${index}`;
        const ca = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.mainPrivateKey));
        const node = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.transportPrivateKey));

        const friendlyName = nodePreset.friendlyName || ca.publicKey.substr(0, 7);

        const nodeAccount: NodeAccount = { name, friendlyName, roles: nodePreset.roles, main: ca, transport: node };

        const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;

        if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.remote = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.remotePrivateKey));
        if (nodePreset.voting) nodeAccount.voting = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.votingPrivateKey));
        if (nodePreset.harvesting) nodeAccount.vrf = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.vrfPrivateKey));
        return nodeAccount;
    }

    public async generateNodeAccounts(presetData: ConfigPreset, networkType: NetworkType): Promise<NodeAccount[]> {
        return Promise.all(presetData.nodes!.map((node, index) => this.generateNodeAccount(presetData, index, node, networkType)));
    }

    private static getArray(size: number): number[] {
        return [...Array(size).keys()];
    }

    public createPresetData({
        password,
        root,
        preset,
        assembly,
        customPreset,
        customPresetObject,
    }: {
        password: string | undefined;
        root: string;
        preset: Preset;
        assembly?: string;
        customPreset?: string;
        customPresetObject?: any;
    }): ConfigPreset {
        const sharedPreset = BootstrapUtils.loadYaml(join(root, 'presets', 'shared.yml'), false);
        const networkPreset = BootstrapUtils.loadYaml(`${root}/presets/${preset}/network.yml`, false);
        const assemblyPreset = assembly ? BootstrapUtils.loadYaml(`${root}/presets/${preset}/assembly-${assembly}.yml`, false) : {};
        const customPresetFileObject = customPreset ? BootstrapUtils.loadYaml(customPreset, password) : {};
        //Deep merge
        const presetData = _.merge(sharedPreset, networkPreset, assemblyPreset, customPresetFileObject, customPresetObject, { preset });
        if (!ConfigLoader.presetInfoLogged) {
            logger.info(`Generating config from preset ${preset}`);
            if (assembly) {
                logger.info(`Assembly preset ${assembly}`);
            }
            if (customPreset) {
                logger.info(`Custom preset file ${customPreset}`);
            }
        }
        ConfigLoader.presetInfoLogged = true;
        if (presetData.assemblies && !assembly) {
            throw new Error(`Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${presetData.assemblies}`);
        }
        const presetDataWithDynamicDefaults = {
            version: 1,
            preset: preset,
            ...presetData,
            nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes),
        };
        return this.expandRepeat(presetDataWithDynamicDefaults);
    }

    public dynamicDefaultNodeConfiguration(nodes?: NodePreset[]): NodePreset[] {
        return _.map(nodes || [], (node) => {
            const roles = this.resolveRoles(node);
            if (node.harvesting && node.api) {
                return {
                    syncsource: true,
                    filespooling: true,
                    partialtransaction: true,
                    openPort: true,
                    sinkType: 'Async',
                    enableSingleThreadPool: false,
                    brokerOpenPort: true,
                    addressextraction: true,
                    enableAutoSyncCleanup: false,
                    mongo: true,
                    zeromq: true,
                    ...node,
                    roles,
                };
            }
            if (node.harvesting) {
                return {
                    sinkType: 'Sync',
                    enableSingleThreadPool: true,
                    addressextraction: false,
                    mongo: false,
                    zeromq: false,
                    syncsource: true,
                    filespooling: false,
                    enableAutoSyncCleanup: true,
                    partialtransaction: false,
                    ...node,
                    roles,
                };
            }
            if (node.api) {
                return {
                    sinkType: 'Async',
                    syncsource: false,
                    filespooling: true,
                    partialtransaction: true,
                    enableSingleThreadPool: false,
                    addressextraction: true,
                    mongo: true,
                    zeromq: true,
                    enableAutoSyncCleanup: false,
                    ...node,
                    roles,
                };
            }
            throw new Error('A node must have at least one harvesting: true or api: true');
        });
    }
    private resolveRoles(nodePreset: NodePreset): string {
        if (nodePreset.roles) {
            return nodePreset.roles;
        }
        const roles: string[] = [];
        if (nodePreset.harvesting) {
            roles.push('Peer');
        }
        if (nodePreset.api) {
            roles.push('Api');
        }
        if (nodePreset.voting) {
            roles.push('Voting');
        }
        return roles.join(',');
    }
    public static toConfig(account: Account): ConfigAccount {
        return {
            privateKey: account.privateKey,
            publicKey: account.publicAccount.publicKey,
            address: account.address.plain(),
        };
    }

    public expandRepeat(presetData: ConfigPreset): ConfigPreset {
        return {
            ...presetData,
            databases: this.expandServicesRepeat(presetData, presetData.databases || []),
            nodes: this.expandServicesRepeat(presetData, presetData.nodes || []),
            gateways: this.expandServicesRepeat(presetData, presetData.gateways || []),
            explorers: this.expandServicesRepeat(presetData, presetData.explorers || []),
            wallets: this.expandServicesRepeat(presetData, presetData.wallets || []),
            faucets: this.expandServicesRepeat(presetData, presetData.faucets || []),
            nemesis: this.applyValueTemplate(presetData, presetData.nemesis),
        };
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public applyValueTemplate(context: any, value: any): any {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return this.expandServicesRepeat(context, value as []);
        }

        if (_.isObject(value)) {
            return _.mapValues(value, (v: any) => this.applyValueTemplate({ ...context, ...value }, v));
        }

        if (!_.isString(value)) {
            return value;
        }
        return BootstrapUtils.runTemplate(value, context);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public expandServicesRepeat(context: any, services: any[]): any[] {
        return _.flatMap(services || [], (service) => {
            if (service.repeat === 0) {
                return [];
            }
            return _.range(service.repeat || 1).map((index) => {
                return _.omit(
                    _.mapValues(service, (v: any) => this.applyValueTemplate({ ...context, ...service, $index: index }, v)),
                    'repeat',
                );
            });
        });
    }

    public loadExistingPresetDataIfPreset(target: string, password: Password): ConfigPreset | undefined {
        const generatedPresetLocation = this.getGeneratedPresetLocation(target);
        if (existsSync(generatedPresetLocation)) {
            return BootstrapUtils.loadYaml(generatedPresetLocation, password);
        }
        return undefined;
    }

    public loadExistingPresetData(target: string, password: Password): ConfigPreset {
        const presetData = this.loadExistingPresetDataIfPreset(target, password);
        if (!presetData) {
            throw new Error(`The file ${this.getGeneratedPresetLocation(target)} doesn't exist. Have you executed the 'config' command?`);
        }
        return presetData;
    }

    public loadExistingAddressesIfPreset(target: string, password: Password): Addresses | undefined {
        const generatedAddressLocation = this.getGeneratedAddressLocation(target);
        if (existsSync(generatedAddressLocation)) {
            const presetData = this.loadExistingPresetData(target, password);
            return this.migrateAddresses(BootstrapUtils.loadYaml(generatedAddressLocation, password), presetData.networkType);
        }
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public migrateAddresses(addresses: any, networkType: NetworkType): Addresses {
        const migrations = this.getAddressesMigration(networkType);
        return BootstrapUtils.migrate('addresses.yml', addresses, migrations);
    }

    public getAddressesMigration(networkType: NetworkType): Migration[] {
        const generateAccount = this.generateAccount;
        return [
            {
                description: 'Key names migration',

                migrate(from: any): any {
                    (from.nodes || []).forEach((nodeAddresses: any): any => {
                        if (nodeAddresses.signing) {
                            nodeAddresses.main = nodeAddresses.signing;
                        } else {
                            if (nodeAddresses.ssl) {
                                nodeAddresses.main = ConfigLoader.toConfig(
                                    Account.createFromPrivateKey(nodeAddresses.ssl.privateKey, networkType),
                                );
                            }
                        }
                        nodeAddresses.transport = ConfigLoader.toConfig(generateAccount(networkType, nodeAddresses?.node?.privateKey));
                        delete nodeAddresses.node;
                        delete nodeAddresses.signing;
                        delete nodeAddresses.ssl;
                    });
                    return from;
                },
            },
        ];
    }

    public loadExistingAddresses(target: string, password: Password): Addresses {
        const addresses = this.loadExistingAddressesIfPreset(target, password);
        if (!addresses) {
            throw new Error(`The file ${this.getGeneratedAddressLocation(target)} doesn't exist. Have you executed the 'config' command?`);
        }
        return addresses;
    }

    public getGeneratedPresetLocation(target: string): string {
        return join(target, 'preset.yml');
    }

    public getGeneratedAddressLocation(target: string): string {
        return join(target, 'addresses.yml');
    }
}
