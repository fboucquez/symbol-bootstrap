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

import * as fs from 'fs';
import { copyFileSync, existsSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import {
    Account,
    AccountKeyLinkTransaction,
    Convert,
    Deadline,
    LinkAction,
    NamespaceId,
    Transaction,
    TransactionMapping,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigPreset, CustomPreset, GatewayConfigPreset, NodeAccount, PeerInfo } from '../model';
import { BootstrapUtils, KnownError, Password } from './BootstrapUtils';
import { CertificateService } from './CertificateService';
import { CommandUtils } from './CommandUtils';
import { ConfigLoader } from './ConfigLoader';
import { CryptoUtils } from './CryptoUtils';
import { NemgenService } from './NemgenService';
import { RemoteNodeService } from './RemoteNodeService';
import { ReportParams, ReportService } from './ReportService';
import { VotingParams, VotingService } from './VotingService';

/**
 * Defined presets.
 */
export enum Preset {
    bootstrap = 'bootstrap',
    testnet = 'testnet',
    mainnet = 'mainnet',
}

export enum Assembly {
    api = 'api',
    demo = 'demo',
    dual = 'dual',
    multinode = 'multinode',
    peer = 'peer',
}

export const defaultAssembly: Record<string, string> = {
    [Preset.bootstrap]: Assembly.multinode,
};

export enum KeyName {
    Main = 'Main',
    Remote = 'Remote',
    Transport = 'Transport',
    Voting = 'Voting',
    VRF = 'VRF',
    NemesisSigner = 'Nemesis Signer',
    NemesisAccount = 'Nemesis Account',
    ServiceProvider = 'Service Provider',
}

export interface ConfigParams extends VotingParams, ReportParams {
    report: boolean;
    reset: boolean;
    upgrade: boolean;
    workingDir: string;
    offline?: boolean;
    preset?: string;
    target: string;
    password?: string;
    user: string;
    assembly?: string;
    customPreset?: string;
    customPresetObject?: CustomPreset;
}

export interface ConfigResult {
    addresses: Addresses;
    presetData: ConfigPreset;
}

export class ConfigService {
    public static defaultParams: ConfigParams = {
        target: BootstrapUtils.defaultTargetFolder,
        workingDir: BootstrapUtils.defaultWorkingDir,
        report: false,
        offline: false,
        reset: false,
        upgrade: false,
        user: BootstrapUtils.CURRENT_USER,
    };
    private readonly configLoader: ConfigLoader;

    constructor(private readonly logger: Logger, private readonly params: ConfigParams) {
        this.configLoader = new ConfigLoader(logger);
    }

    public resolveConfigPreset(password: Password): ConfigPreset {
        const target = this.params.target;
        const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
        if (fs.existsSync(presetLocation) && !this.params.upgrade) {
            return this.configLoader.loadExistingPresetData(target, password);
        }
        const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
        return this.resolveCurrentPresetData(oldPresetData, password);
    }

    public async run(): Promise<ConfigResult> {
        const target = this.params.target;
        try {
            if (this.params.reset) {
                BootstrapUtils.deleteFolder(this.logger, target);
            }
            const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
            const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
            const password = this.params.password;
            if (fs.existsSync(presetLocation) && !this.params.upgrade) {
                this.logger.info(
                    `The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset or --upgrade to upgrade)`,
                );
                const presetData = this.configLoader.loadExistingPresetData(target, password);
                const addresses = this.configLoader.loadExistingAddresses(target, password);
                if (this.params.report) {
                    await new ReportService(this.logger, this.params).run(presetData);
                }
                return { presetData, addresses };
            }

            const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
            if (oldPresetData) {
                // HACK! https://github.com/symbol/symbol-bootstrap/pull/270 would fix this!
                delete oldPresetData.knownPeers;
                delete oldPresetData.knownRestGateways;
            }
            const oldAddresses = this.configLoader.loadExistingAddressesIfPreset(target, password);

            if (oldAddresses && !oldPresetData) {
                throw new KnownError(`Configuration cannot be upgraded without a previous ${presetLocation} file. (run -r to reset)`);
            }

            if (!oldAddresses && oldPresetData) {
                throw new KnownError(`Configuration cannot be upgraded without a previous ${addressesLocation} file. (run -r to reset)`);
            }

            if (oldAddresses && oldPresetData) {
                this.logger.info('Upgrading configuration...');
            }

            const presetData: ConfigPreset = this.resolveCurrentPresetData(oldPresetData, password);
            const addresses = await this.configLoader.generateRandomConfiguration(oldAddresses, oldPresetData, presetData);

            const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
            await BootstrapUtils.mkdir(target);

            const remoteNodeService = new RemoteNodeService(this.logger, presetData, this.params.offline);

            this.cleanUpConfiguration(presetData);
            await this.generateNodeCertificates(presetData, addresses);
            await this.generateNodes(presetData, addresses, remoteNodeService);
            await this.generateGateways(presetData);
            await this.generateExplorers(presetData, remoteNodeService);
            const isUpgrade = !!oldPresetData || !!oldAddresses;
            await this.resolveNemesis(presetData, addresses, isUpgrade);
            await this.copyNemesis(addresses);
            if (this.params.report) {
                await new ReportService(this.logger, this.params).run(presetData);
            }
            await BootstrapUtils.writeYaml(
                addressesLocation,
                CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode),
                password,
            );
            await BootstrapUtils.writeYaml(presetLocation, CryptoUtils.removePrivateKeys(presetData), password);
            this.logger.info(`Configuration generated.`);
            return { presetData, addresses };
        } catch (e) {
            if (e.known) {
                this.logger.error(e.message);
            } else {
                this.logger.error(`Unknown error generating the configuration. ${e.message}`, e);
                this.logger.error(`The target folder '${target}' should be deleted!!!`);
            }
            throw e;
        }
    }

    private resolveCurrentPresetData(oldPresetData: ConfigPreset | undefined, password: Password) {
        return this.configLoader.createPresetData({
            ...this.params,
            workingDir: this.params.workingDir,
            password: password,
            oldPresetData,
        });
    }

    private async copyNemesis(addresses: Addresses) {
        const target = this.params.target;
        const nemesisSeedFolder = BootstrapUtils.getTargetNemesisFolder(target, false, 'seed');
        await this.validateSeedFolder(nemesisSeedFolder, `Invalid final seed folder ${nemesisSeedFolder}`);
        await Promise.all(
            (addresses.nodes || []).map(async (account) => {
                const name = account.name;
                const dataFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'data');
                await BootstrapUtils.mkdir(dataFolder);
                const seedFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'seed');
                await BootstrapUtils.generateConfiguration({}, nemesisSeedFolder, seedFolder);
            }),
        );
    }

    private async validateSeedFolder(nemesisSeedFolder: string, message: string) {
        BootstrapUtils.validateFolder(nemesisSeedFolder);
        const seedData = join(nemesisSeedFolder, '00000', '00001.dat');
        if (!existsSync(seedData)) {
            throw new KnownError(`File ${seedData} doesn't exist! ${message}`);
        }
        const seedIndex = join(nemesisSeedFolder, 'index.dat');
        if (!existsSync(seedIndex)) {
            throw new KnownError(`File ${seedIndex} doesn't exist! ${message}`);
        }
    }

    private async resolveNemesis(presetData: ConfigPreset, addresses: Addresses, isUpgrade: boolean): Promise<void> {
        const target = this.params.target;
        const nemesisSeedFolder = BootstrapUtils.getTargetNemesisFolder(target, false, 'seed');
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        if (ConfigLoader.shouldCreateNemesis(presetData)) {
            if (isUpgrade) {
                this.logger.info('Nemesis data cannot be generated when upgrading...');
            } else {
                BootstrapUtils.deleteFolder(this.logger, nemesisSeedFolder);
                await BootstrapUtils.mkdir(nemesisSeedFolder);
                await this.generateNemesisConfig(presetData, addresses);
                await this.validateSeedFolder(nemesisSeedFolder, `Is the generated nemesis seed a valid seed folder?`);
            }
            return;
        }
        if (isUpgrade) {
            this.logger.info('Upgrading genesis on upgrade!');
        }

        const resolvePresetNemesisSeedFolder = (): string | undefined => {
            if (!presetData.nemesisSeedFolder) {
                return undefined;
            }
            return BootstrapUtils.resolveWorkingDirPath(this.params.workingDir, presetData.nemesisSeedFolder);
        };

        const presetNemesisSeedFolder = resolvePresetNemesisSeedFolder();
        if (presetNemesisSeedFolder) {
            await this.validateSeedFolder(
                presetNemesisSeedFolder,
                `Is the provided preset nemesisSeedFolder: ${presetNemesisSeedFolder} a valid seed folder?`,
            );
            this.logger.info(`Using custom nemesis seed folder in ${presetNemesisSeedFolder}`);
            BootstrapUtils.deleteFolder(this.logger, nemesisSeedFolder);
            await BootstrapUtils.mkdir(nemesisSeedFolder);
            await BootstrapUtils.generateConfiguration({}, presetNemesisSeedFolder, nemesisSeedFolder);
            await this.validateSeedFolder(nemesisSeedFolder, `Is the ${presetData.preset} preset default seed a valid seed folder?`);
            return;
        }
        if (BootstrapUtils.isYmlFile(presetData.preset)) {
            throw new KnownError(`Seed for preset ${presetData.preset} could not be found. Please provide 'nemesisSeedFolder'!`);
        } else {
            const networkNemesisSeed = join(BootstrapUtils.ROOT_FOLDER, 'presets', presetData.preset, 'seed');
            if (existsSync(networkNemesisSeed)) {
                BootstrapUtils.deleteFolder(this.logger, nemesisSeedFolder);
                await BootstrapUtils.mkdir(nemesisSeedFolder);
                await BootstrapUtils.generateConfiguration({}, networkNemesisSeed, nemesisSeedFolder);
                await this.validateSeedFolder(nemesisSeedFolder, `Is the ${presetData.preset} preset default seed a valid seed folder?`);
                return;
            }
            this.logger.warn(`Seed for preset ${presetData.preset} could not be found in ${networkNemesisSeed}`);
            throw new Error('Seed could not be found!!!!');
        }
    }

    private async generateNodes(presetData: ConfigPreset, addresses: Addresses, remoteNodeService: RemoteNodeService): Promise<void> {
        const currentFinalizationEpoch = await remoteNodeService.resolveCurrentFinalizationEpoch();
        const externalPeers: PeerInfo[] = await remoteNodeService.getPeerInfos();
        const localPeers: PeerInfo[] = (presetData.nodes || []).map((nodePresetData, index) => {
            const node = (addresses.nodes || [])[index];
            return {
                publicKey: node.main.publicKey,
                endpoint: {
                    host: nodePresetData.host || '',
                    port: 7900,
                },
                metadata: {
                    name: nodePresetData.friendlyName || '',
                    roles: ConfigLoader.resolveRoles(nodePresetData),
                },
            };
        });
        const allPeers = _.uniqBy([...externalPeers, ...localPeers], (p) => p.publicKey);
        await Promise.all(
            (addresses.nodes || []).map((account, index) =>
                this.generateNodeConfiguration(account, index, presetData, currentFinalizationEpoch, allPeers),
            ),
        );
    }

    private async generateNodeCertificates(presetData: ConfigPreset, addresses: Addresses): Promise<void> {
        await Promise.all(
            (addresses.nodes || []).map((account) => {
                const providedCertificates = {
                    main: account.main,
                    transport: account.transport,
                };
                return new CertificateService(this.logger, this.params).run(presetData, account.name, providedCertificates, false);
            }),
        );
    }

    private async generateNodeConfiguration(
        account: NodeAccount,
        index: number,
        presetData: ConfigPreset,
        currentFinalizationEpoch: number | undefined,
        knownPeers: PeerInfo[],
    ) {
        const copyFrom = join(BootstrapUtils.ROOT_FOLDER, 'config', 'node');
        const name = account.name;

        const serverConfig = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'server-config');
        const brokerConfig = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'broker-config');
        const dataFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'data');
        await BootstrapUtils.mkdir(dataFolder);

        const nodePreset = (presetData.nodes || [])[index];

        const harvesterSigningPrivateKey = nodePreset.harvesting
            ? await CommandUtils.resolvePrivateKey(
                  this.logger,
                  presetData.networkType,
                  account.remote || account.main,
                  account.remote ? KeyName.Remote : KeyName.Main,
                  account.name,
                  'storing the harvesterSigningPrivateKey in the server properties',
              )
            : '';
        const harvesterVrfPrivateKey = await CommandUtils.resolvePrivateKey(
            this.logger,
            presetData.networkType,
            account.vrf,
            KeyName.VRF,
            account.name,
            'storing the harvesterVrfPrivateKey in the server properties',
        );

        const beneficiaryAddress = nodePreset.beneficiaryAddress || presetData.beneficiaryAddress;
        const generatedContext = {
            name: name,
            friendlyName: nodePreset?.friendlyName || account.friendlyName,
            harvesterSigningPrivateKey: harvesterSigningPrivateKey,
            harvesterVrfPrivateKey: harvesterVrfPrivateKey,
            unfinalizedBlocksDuration: nodePreset.voting
                ? presetData.votingUnfinalizedBlocksDuration
                : presetData.nonVotingUnfinalizedBlocksDuration,
            beneficiaryAddress: beneficiaryAddress == undefined ? account.main.address : beneficiaryAddress,
            roles: ConfigLoader.resolveRoles(nodePreset),
        };
        const templateContext: any = { ...presetData, ...generatedContext, ...nodePreset };
        const excludeFiles: string[] = [];

        // Exclude files depending on the enabled extensions. To complete...
        if (!templateContext.harvesting) {
            excludeFiles.push('config-harvesting.properties');
        }
        if (!templateContext.networkheight) {
            excludeFiles.push('config-networkheight.properties');
        }

        const serverRecoveryConfig = {
            addressextractionRecovery: false,
            mongoRecovery: false,
            zeromqRecovery: false,
            filespoolingRecovery: true,
            hashcacheRecovery: true,
        };

        const brokerRecoveryConfig = {
            addressextractionRecovery: true,
            mongoRecovery: true,
            zeromqRecovery: true,
            filespoolingRecovery: false,
            hashcacheRecovery: true,
        };

        this.logger.info(`Generating ${name} server configuration`);
        await BootstrapUtils.generateConfiguration({ ...serverRecoveryConfig, ...templateContext }, copyFrom, serverConfig, excludeFiles);

        const isPeer = (nodePresetData: PeerInfo): boolean => nodePresetData.metadata.roles.includes('Peer');
        const peers = knownPeers.filter((peer) => isPeer(peer) && peer.publicKey != account.main.publicKey);
        const peersP2PFile = await this.generateP2PFile(
            peers,
            presetData.peersP2PListLimit,
            serverConfig,
            `this file contains a list of peers`,
            'peers-p2p.json',
        );

        const isApi = (nodePresetData: PeerInfo): boolean => nodePresetData.metadata.roles.includes('Api');
        const apiPeers = knownPeers.filter((peer) => isApi(peer) && peer.publicKey != account.main.publicKey);
        const peersApiFile = await this.generateP2PFile(
            apiPeers,
            presetData.peersApiListLimit,
            serverConfig,
            `this file contains a list of api peers`,
            'peers-api.json',
        );

        if (!peers.length && !apiPeers.length) {
            this.logger.warn('The peer lists could not be resolved. peers-p2p.json and peers-api.json are empty!');
        }
        if (nodePreset.brokerName) {
            this.logger.info(`Generating ${nodePreset.brokerName} broker configuration`);
            await BootstrapUtils.generateConfiguration(
                { ...brokerRecoveryConfig, ...templateContext },
                copyFrom,
                brokerConfig,
                excludeFiles,
            );
            copyFileSync(peersP2PFile, join(join(brokerConfig, 'resources', 'peers-p2p.json')));
            copyFileSync(peersApiFile, join(join(brokerConfig, 'resources', 'peers-api.json')));
        }

        await new VotingService(this.logger, this.params).run(
            presetData,
            account,
            nodePreset,
            currentFinalizationEpoch,
            undefined,
            ConfigLoader.shouldCreateNemesis(presetData),
        );
    }

    private async generateP2PFile(knownPeers: PeerInfo[], listLimit: number, outputFolder: string, info: string, jsonFileName: string) {
        const data = {
            _info: info,
            knownPeers: _.sampleSize(knownPeers, listLimit),
        };
        const peerFile = join(outputFolder, `resources`, jsonFileName);
        await fs.promises.writeFile(peerFile, JSON.stringify(data, null, 2));
        await fs.promises.chmod(peerFile, 0o600);
        return peerFile;
    }

    private async generateNemesisConfig(presetData: ConfigPreset, addresses: Addresses) {
        if (!presetData.nemesis) {
            throw new Error('nemesis must not be defined!');
        }
        const target = this.params.target;
        const nemesisWorkingDir = BootstrapUtils.getTargetNemesisFolder(target, false);
        const transactionsDirectory = join(nemesisWorkingDir, presetData.nemesis.transactionsDirectory || presetData.transactionsDirectory);
        await BootstrapUtils.mkdir(transactionsDirectory);
        const copyFrom = join(BootstrapUtils.ROOT_FOLDER, `config`, `nemesis`);
        const moveTo = join(nemesisWorkingDir, `server-config`);
        const templateContext = { ...(presetData as any), addresses };
        const nodes = (addresses.nodes || []).filter((n, index) => !presetData.nodes?.[index]?.excludeFromNemesis);

        await Promise.all(nodes.filter((n) => n.vrf).map((n) => this.createVrfTransaction(transactionsDirectory, presetData, n)));
        await Promise.all(
            nodes.filter((n) => n.remote).map((n) => this.createAccountKeyLinkTransaction(transactionsDirectory, presetData, n)),
        );
        await Promise.all(nodes.map((n) => this.createVotingKeyTransactions(transactionsDirectory, presetData, n)));

        if (presetData.nemesis.transactions) {
            const transactionHashes: string[] = [];
            const transactions = (
                await Promise.all(
                    Object.entries(presetData.nemesis.transactions || {})
                        .map(([key, payload]) => {
                            const transactionHash = Transaction.createTransactionHash(
                                payload,
                                Array.from(Convert.hexToUint8(presetData.nemesisGenerationHashSeed)),
                            );
                            if (transactionHashes.indexOf(transactionHash) > -1) {
                                this.logger.warn(`Transaction ${key} wth hash ${transactionHash} already exist. Excluded from folder.`);
                                return undefined;
                            }
                            transactionHashes.push(transactionHash);
                            return this.storeTransaction(transactionsDirectory, key, payload);
                        })
                        .filter((p) => p),
                )
            ).filter((p) => p);
            this.logger.info(`Found ${transactions.length} provided in transactions.`);
        }

        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
        await new NemgenService(this.logger, this.params).run(presetData);
    }

    private async createVrfTransaction(transactionsDirectory: string, presetData: ConfigPreset, node: NodeAccount): Promise<Transaction> {
        if (!node.vrf) {
            throw new Error('VRF keys should have been generated!!');
        }
        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const vrf = VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, LinkAction.Link, presetData.networkType, UInt64.fromUint(0));
        const mainPrivateKey = await CommandUtils.resolvePrivateKey(
            this.logger,
            presetData.networkType,
            node.main,
            KeyName.Main,
            node.name,
            'creating the vrf key link transactions',
        );
        const account = Account.createFromPrivateKey(mainPrivateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
    }

    private async createAccountKeyLinkTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.remote) {
            throw new Error('Remote keys should have been generated!!');
        }
        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const akl = AccountKeyLinkTransaction.create(
            deadline,
            node.remote.publicKey,
            LinkAction.Link,
            presetData.networkType,
            UInt64.fromUint(0),
        );
        const mainPrivateKey = await CommandUtils.resolvePrivateKey(
            this.logger,
            presetData.networkType,
            node.main,
            KeyName.Main,
            node.name,
            'creating the account link transactions',
        );
        const account = Account.createFromPrivateKey(mainPrivateKey, presetData.networkType);
        const signedTransaction = account.sign(akl, presetData.nemesisGenerationHashSeed);
        return this.storeTransaction(transactionsDirectory, `remote_${node.name}`, signedTransaction.payload);
    }

    private async createVotingKeyTransactions(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction[]> {
        const votingFiles = node.voting || [];
        const mainPrivateKey = await CommandUtils.resolvePrivateKey(
            this.logger,
            presetData.networkType,
            node.main,
            KeyName.Main,
            node.name,
            'creating the voting key link transactions',
        );
        return Promise.all(
            votingFiles.map(async (votingFile) => {
                const voting = VotingKeyLinkTransaction.create(
                    Deadline.createFromDTO('1'),
                    votingFile.publicKey,
                    votingFile.startEpoch,
                    votingFile.endEpoch,
                    LinkAction.Link,
                    presetData.networkType,
                    1,
                    UInt64.fromUint(0),
                );
                const account = Account.createFromPrivateKey(mainPrivateKey, presetData.networkType);
                const signedTransaction = account.sign(voting, presetData.nemesisGenerationHashSeed);
                return this.storeTransaction(transactionsDirectory, `voting_${node.name}`, signedTransaction.payload);
            }),
        );
    }

    private async storeTransaction(transactionsDirectory: string, name: string, payload: string): Promise<Transaction> {
        const transaction = TransactionMapping.createFromPayload(payload);
        await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, Convert.hexToUint8(payload));
        return transaction as Transaction;
    }

    private generateGateways(presetData: ConfigPreset) {
        return Promise.all(
            (presetData.gateways || []).map(async (gatewayPreset, index: number) => {
                const copyFrom = join(BootstrapUtils.ROOT_FOLDER, 'config', 'rest-gateway');
                const generatedContext: Partial<GatewayConfigPreset> = {
                    restDeploymentToolVersion: BootstrapUtils.VERSION,
                    restDeploymentToolLastUpdatedDate: new Date().toISOString().slice(0, 10),
                };
                const templateContext = { ...generatedContext, ...presetData, ...gatewayPreset };
                const name = templateContext.name || `rest-gateway-${index}`;
                const moveTo = BootstrapUtils.getTargetGatewayFolder(this.params.target, false, name);
                await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
                const apiNodeConfigFolder = BootstrapUtils.getTargetNodesFolder(
                    this.params.target,
                    false,
                    gatewayPreset.apiNodeName,
                    'server-config',
                    'resources',
                );
                const apiNodeCertFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, gatewayPreset.apiNodeName, 'cert');
                await BootstrapUtils.generateConfiguration(
                    {},
                    apiNodeConfigFolder,
                    join(moveTo, 'api-node-config'),
                    [],
                    ['config-network.properties', 'config-node.properties'],
                );
                await BootstrapUtils.generateConfiguration(
                    {},
                    apiNodeCertFolder,
                    join(moveTo, 'api-node-config', 'cert'),
                    [],
                    ['node.crt.pem', 'node.key.pem', 'ca.cert.pem'],
                );

                if (gatewayPreset.restProtocol === 'HTTPS') {
                    if (gatewayPreset.restSSLKeyBase64 && gatewayPreset.restSSLCertificateBase64) {
                        fs.writeFileSync(join(moveTo, presetData.restSSLKeyFileName), gatewayPreset.restSSLKeyBase64, 'base64');
                        fs.writeFileSync(
                            join(moveTo, presetData.restSSLCertificateFileName),
                            gatewayPreset.restSSLCertificateBase64,
                            'base64',
                        );
                    } else {
                        if (
                            !existsSync(join(moveTo, presetData.restSSLKeyFileName)) &&
                            !existsSync(join(moveTo, presetData.restSSLCertificateFileName))
                        ) {
                            throw new KnownError(
                                `Native SSL is enabled but restSSLKeyBase64 or restSSLCertificateBase64 properties are not found in the custom-preset file! Either use 'symbol-bootstrap wizard' command to fill those properties in the custom-preset or make sure you copy your SSL key and cert files to ${moveTo} folder.`,
                            );
                        } else {
                            this.logger.info(
                                `Native SSL certificates for gateway ${gatewayPreset.name} have been previously provided. Reusing...`,
                            );
                        }
                    }
                }
            }),
        );
    }

    private resolveCurrencyName(presetData: ConfigPreset): string {
        const mosaicPreset = presetData.nemesis?.mosaics?.[0];
        const currencyName = mosaicPreset?.name;
        if (!currencyName) {
            throw new Error('Currency name could not be resolved!!');
        }
        return currencyName;
    }

    private generateExplorers(presetData: ConfigPreset, remoteNodeService: RemoteNodeService) {
        return Promise.all(
            (presetData.explorers || []).map(async (explorerPreset, index: number) => {
                const copyFrom = join(BootstrapUtils.ROOT_FOLDER, 'config', 'explorer');
                const fullName = `${presetData.baseNamespace}.${this.resolveCurrencyName(presetData)}`;
                const namespaceId = new NamespaceId(fullName);
                const { restNodes, defaultNode } = await this.resolveRests(presetData, remoteNodeService);
                const templateContext = {
                    namespaceName: fullName,
                    namespaceId: namespaceId.toHex(),
                    restNodes: restNodes,
                    defaultNode: defaultNode,
                    ...presetData,
                    ...explorerPreset,
                };
                const name = templateContext.name || `explorer-${index}`;
                const moveTo = BootstrapUtils.getTargetFolder(this.params.target, false, BootstrapUtils.targetExplorersFolder, name);
                await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
            }),
        );
    }

    private async resolveRests(
        presetData: ConfigPreset,
        remoteNodeService: RemoteNodeService,
    ): Promise<{ restNodes: string[]; defaultNode: string }> {
        const restNodes: string[] = [];
        presetData.gateways?.forEach((restService) => {
            const nodePreset = presetData.nodes?.find((g) => g.name == restService.apiNodeName);
            restNodes.push(`http://${restService.host || nodePreset?.host || 'localhost'}:3000`);
        });
        restNodes.push(...(await remoteNodeService.getRestUrls()));
        return { restNodes: _.uniq(restNodes), defaultNode: restNodes[0] || 'http://localhost:3000' };
    }

    private cleanUpConfiguration(presetData: ConfigPreset) {
        const target = this.params.target;
        (presetData.nodes || []).forEach(({ name }) => {
            const serverConfigFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'server-config');
            BootstrapUtils.deleteFolder(this.logger, serverConfigFolder);

            const brokerConfigFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'broker-config');
            BootstrapUtils.deleteFolder(this.logger, brokerConfigFolder);

            // Remove old user configs when upgrading.
            const userConfigFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'userconfig');
            BootstrapUtils.deleteFolder(this.logger, userConfigFolder);

            const seedFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'seed');
            BootstrapUtils.deleteFolder(this.logger, seedFolder);
        });
        (presetData.gateways || []).forEach(({ name }) => {
            const configFolder = BootstrapUtils.getTargetGatewayFolder(target, false, name);
            BootstrapUtils.deleteFolder(this.logger, configFolder, [
                join(configFolder, presetData.restSSLKeyFileName),
                join(configFolder, presetData.restSSLCertificateFileName),
            ]);
        });
    }
}
