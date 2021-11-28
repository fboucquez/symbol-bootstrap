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
import { Logger } from '../logger';
import {
    Addresses,
    ConfigAccount,
    ConfigPreset,
    CustomPreset,
    MosaicAccounts,
    NodeAccount,
    NodePreset,
    PrivateKeySecurityMode,
} from '../model';
import { BootstrapUtils, KnownError, Migration, Password } from './BootstrapUtils';
import { CommandUtils } from './CommandUtils';
import { Assembly, defaultAssembly, KeyName } from './ConfigService';
import { CryptoUtils } from './CryptoUtils';

export class ConfigLoader {
    public static presetInfoLogged = false;

    constructor(private readonly logger: Logger) {}
    public async generateRandomConfiguration(
        oldAddresses: Addresses | undefined,
        oldPresetData: ConfigPreset | undefined,
        presetData: ConfigPreset,
    ): Promise<Addresses> {
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
        if (!presetData.harvestNetworkFeeSinkAddressV1) {
            presetData.harvestNetworkFeeSinkAddressV1 = presetData.harvestNetworkFeeSinkAddress;
        }

        if (!presetData.mosaicRentalFeeSinkAddress) {
            presetData.mosaicRentalFeeSinkAddress = addresses.sinkAddress;
        }
        if (!presetData.mosaicRentalFeeSinkAddressV1) {
            presetData.mosaicRentalFeeSinkAddressV1 = presetData.mosaicRentalFeeSinkAddress;
        }

        if (!presetData.namespaceRentalFeeSinkAddress) {
            presetData.namespaceRentalFeeSinkAddress = addresses.sinkAddress;
        }
        if (!presetData.namespaceRentalFeeSinkAddressV1) {
            presetData.namespaceRentalFeeSinkAddressV1 = presetData.namespaceRentalFeeSinkAddress;
        }

        presetData.networkIdentifier = BootstrapUtils.getNetworkIdentifier(presetData.networkType);
        presetData.networkName = BootstrapUtils.getNetworkName(presetData.networkType);
        if (!presetData.nemesisGenerationHashSeed) {
            presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        }
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const shouldCreateNemesis = ConfigLoader.shouldCreateNemesis(presetData);
        if (shouldCreateNemesis) {
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
                this.logger,
                presetData.networkType,
                addresses.nemesisSigner,
                KeyName.NemesisSigner,
                '',
                'creating the network nemesis seed and configuration',
            );
        }

        const nemesisSignerAddress = Address.createFromPublicKey(presetData.nemesisSignerPublicKey, networkType);

        if (!presetData.currencyMosaicId)
            presetData.currencyMosaicId = MosaicId.createFromNonce(MosaicNonce.createFromNumber(0), nemesisSignerAddress).toHex();

        if (!presetData.harvestingMosaicId) {
            if (!presetData.nemesis) {
                throw new Error('nemesis must be defined!');
            }
            if (presetData.nemesis.mosaics && presetData.nemesis.mosaics.length > 1) {
                presetData.harvestingMosaicId = MosaicId.createFromNonce(MosaicNonce.createFromNumber(1), nemesisSignerAddress).toHex();
            } else {
                presetData.harvestingMosaicId = presetData.currencyMosaicId;
            }
        }

        if (shouldCreateNemesis) {
            if (oldAddresses) {
                if (!oldPresetData) {
                    throw new Error('oldPresetData must be defined when upgrading!');
                }
                // Nemesis configuration cannot be changed on upgrade.
                addresses.mosaics = oldAddresses.mosaics;
                presetData.nemesis = oldPresetData.nemesis;
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
    public static shouldCreateNemesis(presetData: ConfigPreset): boolean {
        return (
            presetData.nemesis &&
            !presetData.nemesisSeedFolder &&
            (BootstrapUtils.isYmlFile(presetData.preset) ||
                !existsSync(join(BootstrapUtils.ROOT_FOLDER, 'presets', presetData.preset, 'seed')))
        );
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
        const oldAccount = this.getAccount(
            networkType,
            oldStoredAccount?.publicKey.toUpperCase(),
            oldStoredAccount?.privateKey?.toUpperCase(),
        );
        const newAccount = this.getAccount(networkType, publicKey?.toUpperCase(), privateKey?.toUpperCase());

        const getAccountLog = (account: Account | PublicAccount) =>
            `${keyName} Account ${account.address.plain()} Public Key ${account.publicKey} `;

        if (oldAccount && !newAccount) {
            this.logger.info(`Reusing ${getAccountLog(oldAccount)}...`);
            return this.toConfig(oldAccount);
        }
        if (!oldAccount && newAccount) {
            this.logger.info(`${getAccountLog(newAccount)} has been provided`);
            return this.toConfig(newAccount);
        }
        if (oldAccount && newAccount) {
            if (oldAccount.address.equals(newAccount.address)) {
                this.logger.info(`Reusing ${getAccountLog(newAccount)}`);
                return { ...this.toConfig(oldAccount), ...this.toConfig(newAccount) };
            }
            this.logger.info(`Old ${getAccountLog(oldAccount)} has been changed. New ${getAccountLog(newAccount)} replaces it.`);
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
        this.logger.info(`Generating ${keyName} account...`);
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
            roles: ConfigLoader.resolveRoles(nodePreset),
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
            (presetData.nodes || []).map((node, index) =>
                this.generateNodeAccount(oldAddresses?.nodes?.[index], presetData, index, node, networkType),
            ),
        );
    }

    private static getArray(size: number): number[] {
        return [...Array(size).keys()];
    }

    public loadCustomPreset(customPreset: string | undefined, password: Password): CustomPreset {
        if (!customPreset) {
            return {};
        }
        if (!existsSync(customPreset)) {
            throw new KnownError(
                `Custom preset '${customPreset}' doesn't exist. Have you provided the right --customPreset <customPrestFileLocation> ?`,
            );
        }
        return BootstrapUtils.loadYaml(customPreset, password);
    }

    public static loadAssembly(preset: string, assembly: string, workingDir: string): CustomPreset {
        const fileLocation = join(BootstrapUtils.ROOT_FOLDER, 'presets', 'assemblies', `assembly-${assembly}.yml`);
        const errorMessage = `Assembly '${assembly}' is not valid for preset '${preset}'. Have you provided the right --preset <preset> --assembly <assembly> ?`;
        return this.loadBundledPreset(assembly, fileLocation, workingDir, errorMessage);
    }

    public static loadNetworkPreset(preset: string, workingDir: string): CustomPreset {
        const fileLocation = join(BootstrapUtils.ROOT_FOLDER, 'presets', preset, `network.yml`);
        const errorMessage = `Preset '${preset}' does not exist. Have you provided the right --preset <preset> ?`;
        return this.loadBundledPreset(preset, fileLocation, workingDir, errorMessage);
    }

    private static loadBundledPreset(presetFile: string, bundledLocation: string, workingDir: string, errorMessage: string): CustomPreset {
        if (BootstrapUtils.isYmlFile(presetFile)) {
            const assemblyFile = BootstrapUtils.resolveWorkingDirPath(workingDir, presetFile);
            if (!existsSync(assemblyFile)) {
                throw new KnownError(errorMessage);
            }
            return BootstrapUtils.loadYaml(assemblyFile, false);
        }
        if (existsSync(bundledLocation)) {
            return BootstrapUtils.loadYaml(bundledLocation, false);
        }
        throw new KnownError(errorMessage);
    }

    public static loadSharedPreset(): CustomPreset {
        return BootstrapUtils.loadYaml(join(BootstrapUtils.ROOT_FOLDER, 'presets', 'shared.yml'), false) as ConfigPreset;
    }
    public mergePresets<T extends CustomPreset>(object: T | undefined, ...otherArgs: (CustomPreset | undefined)[]): T {
        const presets = [object, ...otherArgs];
        const reversed = [...presets].reverse();
        const presetData = _.merge({}, ...presets);
        const inflation = reversed.find((p) => !_.isEmpty(p?.inflation))?.inflation;
        const knownRestGateways = reversed.find((p) => !_.isEmpty(p?.knownRestGateways))?.knownRestGateways;
        const knownPeers = reversed.find((p) => !_.isEmpty(p?.knownPeers))?.knownPeers;
        if (inflation) presetData.inflation = inflation;
        if (knownRestGateways) presetData.knownRestGateways = knownRestGateways;
        if (knownPeers) presetData.knownPeers = knownPeers;
        return presetData;
    }
    public createPresetData(params: {
        workingDir: string;
        password: Password;
        preset?: string;
        assembly?: string;
        customPreset?: string;
        customPresetObject?: CustomPreset;
        oldPresetData?: ConfigPreset;
    }): ConfigPreset {
        const customPreset = params.customPreset;
        const customPresetObject = params.customPresetObject;
        const oldPresetData = params.oldPresetData;
        const customPresetFileObject = this.loadCustomPreset(customPreset, params.password);
        const preset = params.preset || params.customPresetObject?.preset || customPresetFileObject?.preset || oldPresetData?.preset;
        if (!preset) {
            throw new KnownError(
                'Preset value could not be resolved from target folder contents. Please provide the --preset parameter when running the config/start command.',
            );
        }

        const sharedPreset = ConfigLoader.loadSharedPreset();
        const networkPreset = ConfigLoader.loadNetworkPreset(preset, params.workingDir);

        const assembly =
            params.assembly ||
            params.customPresetObject?.assembly ||
            customPresetFileObject?.assembly ||
            params.oldPresetData?.assembly ||
            defaultAssembly[preset];

        if (!assembly) {
            throw new KnownError(
                `Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${Object.keys(Assembly).join(', ')}`,
            );
        }

        const assemblyPreset = ConfigLoader.loadAssembly(preset, assembly, params.workingDir);
        const providedCustomPreset = this.mergePresets(customPresetFileObject, customPresetObject);
        const resolvedCustomPreset = _.isEmpty(providedCustomPreset) ? oldPresetData?.customPresetCache || {} : providedCustomPreset;
        const presetData = this.mergePresets(sharedPreset, networkPreset, assemblyPreset, resolvedCustomPreset) as ConfigPreset;

        if (!ConfigLoader.presetInfoLogged) {
            this.logger.info(`Generating config from preset '${preset}'`);
            if (assembly) {
                this.logger.info(`Using assembly '${assembly}'`);
            }
            if (customPreset) {
                this.logger.info(`Using custom preset file '${customPreset}'`);
            }
        }
        if (!presetData.networkType) {
            throw new Error('Network Type could not be resolved. Have your provided the right --preset?');
        }
        ConfigLoader.presetInfoLogged = true;
        const presetDataWithDynamicDefaults: ConfigPreset = {
            ...presetData,
            version: 1,
            preset: preset,
            assembly: assembly,
            nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes),
            customPresetCache: resolvedCustomPreset,
        };
        return this.expandRepeat(presetDataWithDynamicDefaults);
    }

    public dynamicDefaultNodeConfiguration(nodes?: Partial<NodePreset>[]): NodePreset[] {
        return _.map(nodes || [], (node) => {
            return { ...this.getDefaultConfiguration(node), ...node } as NodePreset;
        });
    }

    private getDefaultConfiguration(node: Partial<NodePreset>): Partial<NodePreset> {
        if (node.harvesting && node.api) {
            return {
                syncsource: true,
                filespooling: true,
                partialtransaction: true,
                addressextraction: true,
                mongo: true,
                zeromq: true,
                enableAutoSyncCleanup: false,
            };
        }
        if (node.api) {
            return {
                syncsource: false,
                filespooling: true,
                partialtransaction: true,
                addressextraction: true,
                mongo: true,
                zeromq: true,
                enableAutoSyncCleanup: false,
            };
        }
        // peer only (harvesting or not).
        return {
            syncsource: true,
            filespooling: false,
            partialtransaction: false,
            addressextraction: false,
            mongo: false,
            zeromq: false,
            enableAutoSyncCleanup: true,
        };
    }

    public static resolveRoles(nodePreset: NodePreset): string {
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
            if (!_.isObject(service)) {
                return service;
            }
            const repeat = (service as any).repeat;
            if (repeat === 0) {
                return [];
            }
            return _.range(repeat || 1).map((index) => {
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
            throw new Error(
                `The file ${this.getGeneratedPresetLocation(
                    target,
                )} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`,
            );
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
        return BootstrapUtils.migrate(this.logger, 'addresses.yml', addresses, migrations);
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
            throw new Error(
                `The file ${this.getGeneratedAddressLocation(
                    target,
                )} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`,
            );
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
