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
import { Account, Address, Convert, Crypto, MosaicId, MosaicNonce, NetworkType, PublicAccount } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import {
    Addresses,
    ConfigAccount,
    ConfigPreset,
    CustomPreset,
    DeepPartial,
    MosaicAccounts,
    NodeAccount,
    NodePreset,
    PrivateKeySecurityMode,
} from '../model';
import { BootstrapUtils, KnownError, Migration, Password } from './BootstrapUtils';
import { CommandUtils } from './CommandUtils';
import { KeyName, Preset } from './ConfigService';
import { CryptoUtils } from './CryptoUtils';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ConfigLoader {
    private static presetInfoLogged = false;

    public async generateRandomConfiguration(oldAddresses: Addresses | undefined, presetData: ConfigPreset): Promise<Addresses> {
        const networkType = presetData.networkType;
        const addresses: Addresses = {
            version: this.getAddressesMigration(presetData.networkType).length + 1,
            networkType: networkType,
            nemesisGenerationHashSeed:
                presetData.nemesisGenerationHashSeed ||
                oldAddresses?.nemesisGenerationHashSeed ||
                Convert.uint8ToHex(Crypto.randomBytes(32)),
            sinkAddress: presetData.sinkAddress || oldAddresses?.sinkAddress || Account.generateNewAccount(networkType).address.plain(),
        };

        if (presetData.nodes) {
            addresses.nodes = await this.generateNodeAccounts(oldAddresses, presetData, networkType);
        }

        if (!presetData.harvestNetworkFeeSinkAddress) {
            presetData.harvestNetworkFeeSinkAddress = addresses.sinkAddress;
        }
        if (!presetData.mosaicRentalFeeSinkAddress) {
            presetData.mosaicRentalFeeSinkAddress = addresses.sinkAddress;
        }
        if (!presetData.namespaceRentalFeeSinkAddress) {
            presetData.namespaceRentalFeeSinkAddress = addresses.sinkAddress;
        }

        presetData.networkIdentifier = BootstrapUtils.getNetworkIdentifier(presetData.networkType);
        presetData.networkName = BootstrapUtils.getNetworkName(presetData.networkType);
        if (!presetData.nemesisGenerationHashSeed) {
            presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        }
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        if (presetData.nemesis) {
            addresses.nemesisSigner = this.generateAccount(
                networkType,
                privateKeySecurityMode,
                KeyName.NemesisSigner,
                oldAddresses?.nemesisSigner,
                presetData.nemesis.nemesisSignerPrivateKey,
                presetData.nemesisSignerPublicKey,
            );
            presetData.nemesisSignerPublicKey = addresses.nemesisSigner.publicKey;
            presetData.nemesis.nemesisSignerPrivateKey = await CommandUtils.resolvePrivateKey(
                presetData.networkType,
                addresses.nemesisSigner,
                KeyName.NemesisSigner,
                '',
                'creating the network nemesis seed and configuration',
            );
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
            if (oldAddresses) {
                // Nemesis configuration cannot be changed on upgrade.
                addresses.mosaics = oldAddresses.mosaics;
            } else {
                if (presetData.nemesis.mosaics) {
                    const mosaics: MosaicAccounts[] = [];
                    presetData.nemesis.mosaics.forEach((m, index) => {
                        const accounts = this.generateAddresses(networkType, privateKeySecurityMode, m.accounts);
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
                            const nodeMainAccounts = (addresses.nodes || []).filter((node) => node.main);
                            const totalAccounts = (m.accounts || 0) + nodeMainAccounts.length;
                            const amountPerAccount = Math.floor(m.supply / totalAccounts);
                            m.currencyDistributions = [
                                ...accounts.map((a) => ({ address: a.address, amount: amountPerAccount })),
                                ...nodeMainAccounts.map((n) => ({ address: n.main!.address, amount: amountPerAccount })),
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
        }

        return addresses;
    }

    public generateAddresses(networkType: NetworkType, privateKeySecurityMode: PrivateKeySecurityMode, size: number): ConfigAccount[] {
        return ConfigLoader.getArray(size).map(() =>
            this.generateAccount(networkType, privateKeySecurityMode, KeyName.NemesisAccount, undefined, undefined, undefined),
        );
    }

    public getAccount(
        networkType: NetworkType,
        publicKey: string | undefined,
        privateKey: string | undefined,
    ): PublicAccount | Account | undefined {
        if (privateKey) {
            return Account.createFromPrivateKey(privateKey, networkType);
        }
        if (publicKey) {
            return PublicAccount.createFromPublicKey(publicKey, networkType);
        }
        return undefined;
    }

    public toConfig(account: PublicAccount | Account): ConfigAccount {
        if (account instanceof Account) {
            return {
                privateKey: account.privateKey,
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
        return {
            publicKey: account.publicKey,
            address: account.address.plain(),
        };
    }

    public generateAccount(
        networkType: NetworkType,
        privateKeySecurityMode: PrivateKeySecurityMode,
        keyName: KeyName,
        oldStoredAccount: ConfigAccount | undefined,
        privateKey: string | undefined,
        publicKey: string | undefined,
    ): ConfigAccount {
        const oldAccount = this.getAccount(networkType, oldStoredAccount?.publicKey, oldStoredAccount?.privateKey);
        const newAccount = this.getAccount(networkType, publicKey, privateKey);
        if (oldAccount && !newAccount) {
            logger.info(`Reusing ${keyName} account ${oldAccount.address.plain()}`);
            return this.toConfig(oldAccount);
        }
        if (!oldAccount && newAccount) {
            logger.info(`${keyName} Account ${newAccount.address.plain()} has been provided`);
            return this.toConfig(newAccount);
        }
        if (oldAccount && newAccount) {
            if (oldAccount.address.equals(newAccount.address)) {
                logger.info(`Reusing ${keyName} account ${oldAccount.address.plain()}`);
                return { ...this.toConfig(oldAccount), ...this.toConfig(newAccount) };
            }
            logger.info(
                `Old ${keyName} Account ${oldAccount.address.plain()} has been changed. New ${keyName} Account is ${newAccount.address.plain()}`,
            );
            return this.toConfig(newAccount);
        }

        //Generation validation.
        if (
            keyName === KeyName.Main &&
            (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN)
        ) {
            throw new KnownError(
                `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, or provider your ${keyName} account with custom presets!`,
            );
        }
        if (
            keyName === KeyName.Transport &&
            (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT)
        ) {
            throw new KnownError(
                `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, or provider your ${keyName} account with custom presets!`,
            );
        } else {
            if (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL) {
                throw new KnownError(
                    `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere! Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, ${PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT}, or provider your ${keyName} account with custom presets!`,
                );
            }
        }
        logger.info(`Generating ${keyName} account...`);
        return ConfigLoader.toConfig(Account.generateNewAccount(networkType));
    }

    public generateNodeAccount(
        oldNodeAccount: NodeAccount | undefined,
        presetData: ConfigPreset,
        index: number,
        nodePreset: NodePreset,
        networkType: NetworkType,
    ): NodeAccount {
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const name = nodePreset.name || `node-${index}`;
        const main = this.generateAccount(
            networkType,
            privateKeySecurityMode,
            KeyName.Main,
            oldNodeAccount?.main,
            nodePreset.mainPrivateKey,
            nodePreset.mainPublicKey,
        );
        const transport = this.generateAccount(
            networkType,
            privateKeySecurityMode,
            KeyName.Transport,
            oldNodeAccount?.transport,
            nodePreset.transportPrivateKey,
            nodePreset.transportPublicKey,
        );

        const friendlyName = nodePreset.friendlyName || main.publicKey.substr(0, 7);

        const nodeAccount: NodeAccount = {
            name,
            friendlyName,
            roles: nodePreset.roles || '',
            main: main,
            transport: transport,
        };

        const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;

        if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.remote = this.generateAccount(
                networkType,
                privateKeySecurityMode,
                KeyName.Remote,
                oldNodeAccount?.remote,
                nodePreset.remotePrivateKey,
                nodePreset.remotePublicKey,
            );
        if (nodePreset.voting)
            nodeAccount.voting = this.toConfig(
                oldNodeAccount?.voting
                    ? PublicAccount.createFromPublicKey(oldNodeAccount.voting.publicKey, networkType)
                    : Account.generateNewAccount(networkType),
            );
        if (nodePreset.harvesting)
            nodeAccount.vrf = this.generateAccount(
                networkType,
                privateKeySecurityMode,
                KeyName.VRF,
                oldNodeAccount?.vrf,
                nodePreset.vrfPrivateKey,
                nodePreset.vrfPublicKey,
            );
        return nodeAccount;
    }

    public async generateNodeAccounts(
        oldAddresses: Addresses | undefined,
        presetData: ConfigPreset,
        networkType: NetworkType,
    ): Promise<NodeAccount[]> {
        return Promise.all(
            presetData.nodes!.map((node, index) =>
                this.generateNodeAccount(oldAddresses?.nodes?.[index], presetData, index, node, networkType),
            ),
        );
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
        customPresetObject?: CustomPreset;
    }): ConfigPreset {
        const sharedPreset: ConfigPreset = BootstrapUtils.loadYaml(join(root, 'presets', 'shared.yml'), false);
        const networkPreset: CustomPreset = BootstrapUtils.loadYaml(`${root}/presets/${preset}/network.yml`, false);
        const assemblyPreset: CustomPreset = assembly
            ? BootstrapUtils.loadYaml(`${root}/presets/${preset}/assembly-${assembly}.yml`, false)
            : {};
        const customPresetFileObject: CustomPreset = customPreset ? BootstrapUtils.loadYaml(customPreset, password) : {};
        //Deep merge
        const inflation: Record<string, number> =
            customPresetObject?.inflation ||
            customPresetFileObject?.inflation ||
            assemblyPreset?.inflation ||
            networkPreset?.inflation ||
            sharedPreset?.inflation ||
            {};
        const presetData: ConfigPreset = _.merge(sharedPreset, networkPreset, assemblyPreset, customPresetFileObject, customPresetObject, {
            version: 1,
            bootstrapVersion: BootstrapUtils.VERSION,
            preset: preset,
            assembly: assembly || 'default',
        });
        presetData.inflation = inflation;
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
        const presetDataWithDynamicDefaults: ConfigPreset = {
            ...presetData,
            nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes),
        };
        return this.expandRepeat(presetDataWithDynamicDefaults);
    }

    public dynamicDefaultNodeConfiguration(nodes?: NodePreset[]): NodePreset[] {
        return _.map(nodes || [], (node) => {
            const expandedNodeConfiguration = { ...this.getDefaultConfiguration(node), ...node };
            const roles = this.resolveRoles(expandedNodeConfiguration);
            return { ...expandedNodeConfiguration, roles };
        });
    }

    private getDefaultConfiguration(node: NodePreset): DeepPartial<NodePreset> {
        if (node.harvesting && node.api) {
            return {
                syncsource: true,
                filespooling: true,
                partialtransaction: true,
                openPort: true,
                sinkType: 'Async',
                enableSingleThreadPool: false,
                addressextraction: true,
                enableAutoSyncCleanup: false,
                mongo: true,
                zeromq: true,
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
            };
        }
        //peer only (harvesting or not).
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
        };
    }

    private resolveRoles(nodePreset: NodePreset): string {
        if (nodePreset.roles) {
            return nodePreset.roles;
        }
        const roles: string[] = [];
        if (nodePreset.syncsource) {
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

    public static toConfig(account: Account | PublicAccount): ConfigAccount {
        if (account instanceof Account) {
            return {
                privateKey: account.privateKey,
                publicKey: account.publicAccount.publicKey,
                address: account.address.plain(),
            };
        } else {
            return {
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
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
                    _.mapValues(service, (v: any) =>
                        this.applyValueTemplate(
                            {
                                ...context,
                                ...service,
                                $index: index,
                            },
                            v,
                        ),
                    ),
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
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const configLoader = this;
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
                        nodeAddresses.transport = configLoader.generateAccount(
                            networkType,
                            PrivateKeySecurityMode.ENCRYPT,
                            KeyName.Transport,
                            undefined,
                            nodeAddresses?.node?.privateKey,
                            undefined,
                        );
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
