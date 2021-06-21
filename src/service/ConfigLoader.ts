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
import { AccountResolver } from './AccountResolver';
import { BootstrapUtils, KnownError, Migration, Password } from './BootstrapUtils';
import { Assembly, KeyName } from './ConfigService';
import { CryptoUtils } from './CryptoUtils';

export class ConfigLoader {
    public static presetInfoLogged = false;

    constructor(private readonly logger: Logger) {}

    public async generateRandomConfiguration(
        oldAddresses: Addresses | undefined,
        oldPresetData: ConfigPreset | undefined,
        presetData: ConfigPreset,
        accountResolver: AccountResolver,
    ): Promise<Addresses> {
        const networkType = presetData.networkType;

        const addresses: Addresses = {
            version: this.getAddressesMigration(networkType).length + 1,
            networkType: networkType,
            nemesisGenerationHashSeed:
                presetData.nemesisGenerationHashSeed ||
                oldAddresses?.nemesisGenerationHashSeed ||
                Convert.uint8ToHex(Crypto.randomBytes(32)),
            sinkAddress: presetData.sinkAddress || oldAddresses?.sinkAddress,
        };

        //Sync address is generated on demand only
        const resolveSyncAddress = (providedAddress: string | undefined): string => {
            if (providedAddress) {
                return Address.createFromRawAddress(providedAddress).plain();
            }
            addresses.sinkAddress = addresses.sinkAddress || Account.generateNewAccount(networkType).address.plain();
            return addresses.sinkAddress;
        };

        presetData.harvestNetworkFeeSinkAddress = resolveSyncAddress(presetData.harvestNetworkFeeSinkAddress);
        presetData.mosaicRentalFeeSinkAddress = resolveSyncAddress(presetData.mosaicRentalFeeSinkAddress);
        presetData.namespaceRentalFeeSinkAddress = resolveSyncAddress(presetData.namespaceRentalFeeSinkAddress);
        presetData.networkIdentifier = BootstrapUtils.getNetworkIdentifier(networkType);
        presetData.networkName = BootstrapUtils.getNetworkName(networkType);
        presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        addresses.nodes = await this.generateNodeAccounts(accountResolver, oldAddresses, presetData, networkType);

        const shouldCreateNemesis = ConfigLoader.shouldCreateNemesis(presetData);
        if (shouldCreateNemesis) {
            const nemesisSigner = this.resolveNemesisAccount(presetData, oldAddresses);
            if (!nemesisSigner.privateKey) {
                throw new Error('Nemesis Signer Private Key should be resolved!');
            }
            addresses.nemesisSigner = nemesisSigner;
            presetData.nemesisSignerPublicKey = nemesisSigner.publicKey;
            presetData.nemesis.nemesisSignerPrivateKey = nemesisSigner.privateKey;
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
                addresses.mosaics = this.processNemesisBalances(presetData, addresses, nemesisSignerAddress);
            }
        }

        return addresses;
    }

    private resolveNemesisAccount(presetData: ConfigPreset, oldAddresses: Addresses | undefined): ConfigAccount {
        const networkType = presetData.networkType;
        const signerPrivateKey =
            presetData.nemesis.nemesisSignerPrivateKey ||
            oldAddresses?.nemesisSigner?.privateKey ||
            Account.generateNewAccount(networkType).privateKey;

        const signerPublicKey = presetData.nemesisSignerPublicKey || oldAddresses?.nemesisSigner?.publicKey;
        const nemesisSigner = ConfigLoader.toConfigFromKeys(networkType, signerPublicKey, signerPrivateKey);

        if (!nemesisSigner) {
            throw new Error('Nemesis Signer should be resolved!');
        }
        return nemesisSigner;
    }
    private sum(distribution: { amount: number; address: string }[], mosaicName: string) {
        return distribution
            .map((d, index) => {
                if (d.amount < 0) {
                    throw new Error(
                        `Nemesis distribution balance cannot be less than 0. Mosaic ${mosaicName}, distribution address: ${
                            d.address
                        }, amount: ${d.amount}, index ${index}. \nDistributions are:\n${BootstrapUtils.toYaml(distribution)}`,
                    );
                }
                return d.amount;
            })
            .reduce((a, b) => a + b, 0);
    }
    private processNemesisBalances(presetData: ConfigPreset, addresses: Addresses, nemesisSignerAddress: Address): MosaicAccounts[] {
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const networkType = presetData.networkType;
        const mosaics: MosaicAccounts[] = [];
        presetData.nemesis.mosaics.forEach((m, mosaicIndex) => {
            const accounts = this.generateAddresses(networkType, privateKeySecurityMode, m.accounts || 1);
            const id = MosaicId.createFromNonce(MosaicNonce.createFromNumber(mosaicIndex), nemesisSignerAddress).toHex();
            mosaics.push({
                id: id,
                name: m.name,
                accounts,
            });
            const getBalance = (nodeIndex: number): number | undefined => {
                const node = presetData?.nodes?.[nodeIndex];
                if (!node) {
                    return undefined;
                }
                const balance = node?.balances?.[mosaicIndex];
                if (balance !== undefined) {
                    return balance;
                }
                if (node.excludeFromNemesis) {
                    return 0;
                }
                return undefined;
            };
            const providedDistributions = [...(m.currencyDistributions || [])];
            addresses.nodes?.forEach((node, index) => {
                const balance = getBalance(index);
                if (balance !== undefined)
                    providedDistributions.push({
                        address: node.main.address,
                        amount: balance,
                    });
            });
            const nodeMainAccounts = (addresses.nodes || []).filter((node, index) => node.main && getBalance(index) === undefined);
            const providedSupply = this.sum(providedDistributions, m.name);
            const remainingSupply = m.supply - providedSupply;
            const dynamicAccounts = accounts.length + nodeMainAccounts.length;
            const amountPerAccount = Math.floor(remainingSupply / dynamicAccounts);
            const maxHarvesterBalance = this.getMaxHarvesterBalance(presetData, mosaicIndex);
            const generatedAccounts = [
                ...accounts.map((a) => ({
                    address: a.address,
                    amount: amountPerAccount,
                })),
                ...nodeMainAccounts.map((n) => ({
                    address: n.main.address,
                    amount: Math.min(maxHarvesterBalance, amountPerAccount),
                })),
            ];
            m.currencyDistributions = [...generatedAccounts, ...providedDistributions].filter((d) => d.amount > 0);

            const generatedSupply = this.sum(generatedAccounts.slice(1), m.name);

            m.currencyDistributions[0].amount = m.supply - providedSupply - generatedSupply;

            const supplied = this.sum(m.currencyDistributions, m.name);
            if (m.supply != supplied) {
                throw new Error(
                    `Invalid nemgen total supplied value, expected ${
                        m.supply
                    } but total is ${supplied}. \nDistributions are:\n${BootstrapUtils.toYaml(m.currencyDistributions)}`,
                );
            }
        });
        return mosaics;
    }

    private getMaxHarvesterBalance(presetData: ConfigPreset, mosaicIndex: number) {
        return (presetData.nemesis.mosaics.length == 1 && mosaicIndex == 0) || (presetData.nemesis.mosaics.length > 1 && mosaicIndex == 1)
            ? presetData.maxHarvesterBalance
            : Number.MAX_SAFE_INTEGER;
    }

    public static shouldCreateNemesis(presetData: ConfigPreset): boolean {
        return (
            presetData.nemesis &&
            !presetData.nemesisSeedFolder &&
            (BootstrapUtils.isYmlFile(presetData.preset) ||
                !existsSync(join(BootstrapUtils.DEFAULT_ROOT_FOLDER, 'presets', presetData.preset, 'seed')))
        );
    }

    public generateAddresses(
        networkType: NetworkType,
        privateKeySecurityMode: PrivateKeySecurityMode,
        accounts: number | string[],
    ): ConfigAccount[] {
        if (typeof accounts == 'number') {
            return ConfigLoader.getArray(accounts).map(() => ConfigLoader.toConfigFromAccount(Account.generateNewAccount(networkType)));
        } else {
            return accounts.map((key) => ConfigLoader.toConfigFromAccount(PublicAccount.createFromPublicKey(key, networkType)));
        }
    }

    public static toAccountFromKeys(
        networkType: NetworkType,
        publicKey: string | undefined,
        privateKey: string | undefined,
    ): PublicAccount | Account | undefined {
        if (privateKey) {
            const account = Account.createFromPrivateKey(privateKey, networkType);
            if (publicKey && account.publicKey.toUpperCase() != publicKey.toUpperCase()) {
                throw new Error('Invalid provided public key/private key!');
            }
            return account;
        }
        if (publicKey) {
            return PublicAccount.createFromPublicKey(publicKey, networkType);
        }
        return undefined;
    }

    public static toConfigFromAccount(account: PublicAccount | Account): ConfigAccount {
        // isntanceof doesn't work when loaded in multiple libraries.
        //https://stackoverflow.com/questions/59265098/instanceof-not-work-correctly-in-typescript-library-project
        if (account.constructor.name === Account.name) {
            return {
                privateKey: (account as Account).privateKey,
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
        return {
            publicKey: account.publicKey,
            address: account.address.plain(),
        };
    }

    public static toConfigFromKeys(
        networkType: NetworkType,
        publicKey: string | undefined,
        privateKey: string | undefined,
    ): ConfigAccount | undefined {
        const account = this.toAccountFromKeys(networkType, publicKey, privateKey);
        if (!account) {
            return undefined;
        }
        return this.toConfigFromAccount(account);
    }
    public resolveGenerateErrorMessage(keyName: KeyName, privateKeySecurityMode: PrivateKeySecurityMode): string | undefined {
        if (
            keyName === KeyName.Main &&
            (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN)
        ) {
            return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, or provider your ${keyName} account with custom presets!`;
        }
        if (
            keyName === KeyName.Transport &&
            (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT)
        ) {
            return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, or provider your ${keyName} account with custom presets!`;
        } else {
            if (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL) {
                return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere! Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, ${PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT}, or provider your ${keyName} account with custom presets!`;
            }
        }
        return undefined;
    }

    public async generateAccount(
        accountResolver: AccountResolver,
        networkType: NetworkType,
        privateKeySecurityMode: PrivateKeySecurityMode,
        keyName: KeyName,
        nodeName: string,
        oldStoredAccount: ConfigAccount | undefined,
        newProvidedAccount: ConfigAccount | undefined,
    ): Promise<ConfigAccount> {
        const oldAccount = ConfigLoader.toAccountFromKeys(
            networkType,
            oldStoredAccount?.publicKey.toUpperCase(),
            oldStoredAccount?.privateKey?.toUpperCase(),
        );
        const newAccount = ConfigLoader.toAccountFromKeys(
            networkType,
            newProvidedAccount?.publicKey?.toUpperCase(),
            newProvidedAccount?.privateKey?.toUpperCase(),
        );

        const getAccountLog = (a: Account | PublicAccount) => `${keyName} Account ${a.address.plain()} Public Key ${a.publicKey} `;

        if (oldAccount && newAccount) {
            if (oldAccount.address.equals(newAccount.address)) {
                this.logger.info(`Reusing ${getAccountLog(newAccount)}`);
                return { ...ConfigLoader.toConfigFromAccount(oldAccount), ...ConfigLoader.toConfigFromAccount(newAccount) };
            }
            this.logger.info(`Old ${getAccountLog(oldAccount)} has been changed. New ${getAccountLog(newAccount)} replaces it.`);
            return ConfigLoader.toConfigFromAccount(newAccount);
        }
        if (oldAccount) {
            this.logger.info(`Reusing ${getAccountLog(oldAccount)}...`);
            return ConfigLoader.toConfigFromAccount(oldAccount);
        }
        if (newAccount) {
            this.logger.info(`${getAccountLog(newAccount)} has been provided`);
            return ConfigLoader.toConfigFromAccount(newAccount);
        }

        const generateErrorMessage = this.resolveGenerateErrorMessage(keyName, privateKeySecurityMode);

        const account = await accountResolver.resolveAccount(
            networkType,
            newProvidedAccount || oldStoredAccount,
            keyName,
            nodeName,
            'initialization',
            generateErrorMessage,
        );
        return ConfigLoader.toConfigFromAccount(account);
    }

    public async generateNodeAccount(
        accountResolver: AccountResolver,
        oldNodeAccount: NodeAccount | undefined,
        presetData: ConfigPreset,
        index: number,
        nodePreset: NodePreset,
        networkType: NetworkType,
    ): Promise<NodeAccount> {
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const name = nodePreset.name || `node-${index}`;
        const main = await this.generateAccount(
            accountResolver,
            networkType,
            privateKeySecurityMode,
            KeyName.Main,
            nodePreset.name,
            oldNodeAccount?.main,
            ConfigLoader.toConfigFromKeys(networkType, nodePreset.mainPublicKey, nodePreset.mainPrivateKey),
        );
        const transport = await this.generateAccount(
            accountResolver,
            networkType,
            privateKeySecurityMode,
            KeyName.Transport,
            nodePreset.name,
            oldNodeAccount?.transport,
            ConfigLoader.toConfigFromKeys(networkType, nodePreset.transportPublicKey, nodePreset.transportPrivateKey),
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
            nodeAccount.remote = await this.generateAccount(
                accountResolver,
                networkType,
                privateKeySecurityMode,
                KeyName.Remote,
                nodePreset.name,
                oldNodeAccount?.remote,
                ConfigLoader.toConfigFromKeys(networkType, nodePreset.remotePublicKey, nodePreset.remotePrivateKey),
            );
        if (nodePreset.harvesting)
            nodeAccount.vrf = await this.generateAccount(
                accountResolver,
                networkType,
                privateKeySecurityMode,
                KeyName.VRF,
                nodePreset.name,
                oldNodeAccount?.vrf,
                ConfigLoader.toConfigFromKeys(networkType, nodePreset.vrfPublicKey, nodePreset.vrfPrivateKey),
            );
        if (nodePreset.rewardProgram)
            nodeAccount.agent = await this.generateAccount(
                accountResolver,
                networkType,
                privateKeySecurityMode,
                KeyName.Agent,
                nodePreset.name,
                oldNodeAccount?.agent,
                ConfigLoader.toConfigFromKeys(networkType, nodePreset.agentPublicKey, nodePreset.agentPrivateKey),
            );
        return nodeAccount;
    }

    public async generateNodeAccounts(
        accountResolver: AccountResolver,
        oldAddresses: Addresses | undefined,
        presetData: ConfigPreset,
        networkType: NetworkType,
    ): Promise<NodeAccount[]> {
        return Promise.all(
            (presetData.nodes || []).map((node, index) =>
                this.generateNodeAccount(accountResolver, oldAddresses?.nodes?.[index], presetData, index, node, networkType),
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
        if (BootstrapUtils.isYmlFile(assembly)) {
            const assemblyFile = BootstrapUtils.resolveWorkingDirPath(workingDir, assembly);
            if (!existsSync(assemblyFile)) {
                throw new KnownError(
                    `Assembly '${assembly}' does not exist. Have you provided the right --preset <preset> --assembly <assembly> ?`,
                );
            }
            return BootstrapUtils.loadYaml(assemblyFile, false);
        }
        const fileLocation = `${BootstrapUtils.DEFAULT_ROOT_FOLDER}/presets/assemblies/assembly-${assembly}.yml`;
        if (existsSync(fileLocation)) {
            return BootstrapUtils.loadYaml(fileLocation, false);
        }
        throw new KnownError(
            `Assembly '${assembly}' is not valid for preset '${preset}'. Have you provided the right --preset <preset> --assembly <assembly> ?`,
        );
    }

    public static loadNetworkPreset(preset: string, workingDir: string): CustomPreset {
        if (BootstrapUtils.isYmlFile(preset)) {
            const presetFile = BootstrapUtils.resolveWorkingDirPath(workingDir, preset);
            if (!existsSync(presetFile)) {
                throw new KnownError(`Preset '${presetFile}' does not exist. Have you provided the right --preset <preset>`);
            }
            return BootstrapUtils.loadYaml(presetFile, false);
        }
        const bundledPreset = `${BootstrapUtils.DEFAULT_ROOT_FOLDER}/presets/${preset}/network.yml`;
        if (!existsSync(bundledPreset)) {
            throw new KnownError(`Preset '${preset}' does not exist. Have you provided the right --preset <preset>`);
        }
        return BootstrapUtils.loadYaml(bundledPreset, false);
    }

    public static loadSharedPreset(): CustomPreset {
        return BootstrapUtils.loadYaml(join(BootstrapUtils.DEFAULT_ROOT_FOLDER, 'presets', 'shared.yml'), false) as ConfigPreset;
    }

    public mergePresets<T extends CustomPreset>(object: T | undefined, ...otherArgs: (CustomPreset | undefined)[]): T {
        const presets = [object, ...otherArgs];
        const reverse = [...presets].reverse();
        const inflation: Record<string, number> = reverse.find((p) => p?.inflation)?.inflation || {};
        const presetData = _.merge({}, ...presets);
        if (!_.isEmpty(inflation)) presetData.inflation = inflation;
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
            throw new KnownError('Preset value could not be resolved from target folder contents. Please provide the --preset parameter.');
        }
        const assembly =
            params.assembly ||
            params.customPresetObject?.assembly ||
            customPresetFileObject?.assembly ||
            params.oldPresetData?.assembly ||
            Assembly.dual;

        const sharedPreset = ConfigLoader.loadSharedPreset();
        const networkPreset = ConfigLoader.loadNetworkPreset(preset, params.workingDir);
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
            assembly: assembly || '',
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
        return [
            {
                description: 'Key names migration',

                migrate(from: any): any {
                    (from.nodes || []).forEach((nodeAddresses: any): any => {
                        if (nodeAddresses.signing) {
                            nodeAddresses.main = nodeAddresses.signing;
                        } else {
                            if (nodeAddresses.ssl) {
                                nodeAddresses.main = ConfigLoader.toConfigFromAccount(
                                    Account.createFromPrivateKey(nodeAddresses.ssl.privateKey, networkType),
                                );
                            }
                        }
                        nodeAddresses.transport = ConfigLoader.toConfigFromKeys(
                            networkType,
                            nodeAddresses?.node?.publicKey,
                            nodeAddresses?.node?.privateKey,
                        );
                        if (!nodeAddresses.transport) {
                            nodeAddresses.transport = ConfigLoader.toConfigFromAccount(Account.generateNewAccount(networkType));
                        }
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
