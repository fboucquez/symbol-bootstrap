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
import * as _ from 'lodash';
import { join } from 'path';
import {
    Account,
    AccountKeyLinkTransaction,
    Convert,
    Deadline,
    LinkAction,
    NodeKeyLinkTransaction,
    Transaction,
    TransactionMapping,
    UInt64,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset, NodeAccount, NodePreset, NodeType } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { CertificateService } from './CertificateService';
import { ConfigLoader } from './ConfigLoader';
import { NemgenService } from './NemgenService';
import { ReportService } from './ReportService';
import { VotingService } from './VotingService';

/**
 * Defined presets.
 */
export enum Preset {
    bootstrap = 'bootstrap',
    testnet = 'testnet',
}

export interface ConfigParams {
    report: boolean;
    reset: boolean;
    upgrade: boolean;
    preset: Preset;
    target: string;
    user: string;
    pullImages?: boolean;
    assembly?: string;
    customPreset?: string;
    customPresetObject?: any;
}

export interface ConfigResult {
    addresses: Addresses;
    presetData: ConfigPreset;
}

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ConfigService {
    public static defaultParams: ConfigParams = {
        target: BootstrapUtils.defaultTargetFolder,
        report: false,
        preset: Preset.bootstrap,
        reset: false,
        upgrade: false,
        pullImages: false,
        user: BootstrapUtils.CURRENT_USER,
    };
    private readonly configLoader: ConfigLoader;

    constructor(private readonly root: string, private readonly params: ConfigParams) {
        this.configLoader = new ConfigLoader();
    }

    public async run(): Promise<ConfigResult> {
        const target = this.params.target;
        try {
            if (this.params.reset) {
                BootstrapUtils.deleteFolder(target);
            }
            const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
            const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
            if (fs.existsSync(presetLocation) && !this.params.upgrade) {
                logger.info(
                    `The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset or --upgrade to upgrade)`,
                );
                const presetData = this.configLoader.loadExistingPresetData(target);
                const addresses = this.configLoader.loadExistingAddresses(target);
                if (this.params.report) {
                    await new ReportService(this.root, this.params).run(presetData);
                }
                await BootstrapUtils.writeYaml(this.configLoader.getGeneratedAddressLocation(target), addresses);
                await BootstrapUtils.writeYaml(presetLocation, presetData);
                return { presetData, addresses };
            }

            const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target);
            const oldAddresses = this.configLoader.loadExistingAddressesIfPreset(target);

            if (oldAddresses && !oldPresetData) {
                throw new Error(`Configuration cannot be upgraded without a previous ${presetLocation} file. (run -r to reset)`);
            }

            if (!oldAddresses && oldPresetData) {
                throw new Error(`Configuration cannot be upgraded without a previous ${addressesLocation} file. (run -r to reset)`);
            }

            if (oldAddresses && oldPresetData) {
                logger.info('Upgrading configuration...');
            }

            const presetData: ConfigPreset = _.merge(
                oldPresetData || {},
                this.configLoader.createPresetData(
                    this.root,
                    this.params.preset,
                    this.params.assembly,
                    this.params.customPreset,
                    this.params.customPresetObject,
                ),
            );

            if (this.params.pullImages) await BootstrapUtils.pullImage(presetData.symbolServerToolsImage);
            const addresses = oldAddresses || (await this.configLoader.generateRandomConfiguration(presetData));

            await BootstrapUtils.mkdir(target);

            this.cleanUpConfiguration(presetData);

            await this.generateNodeCertificates(presetData, addresses);
            await this.generateNodes(presetData, addresses);
            await this.generateGateways(presetData);
            await this.generateExplorers(presetData);
            await this.generateWallets(presetData);
            if (!oldPresetData && !oldAddresses) {
                await this.generateNemesis(presetData, addresses);
            } else {
                logger.info('Nemesis data cannot be generated or copied when upgrading...');
            }

            if (this.params.report) {
                await new ReportService(this.root, this.params).run(presetData);
            }

            await BootstrapUtils.writeYaml(this.configLoader.getGeneratedAddressLocation(target), addresses);
            await BootstrapUtils.writeYaml(presetLocation, presetData);
            logger.info(`Configuration generated.`);
            return { presetData, addresses };
        } catch (e) {
            logger.error(`Unknown error generating the configuration. ${e.message}`, e);
            logger.error(`The target folder '${target}' should be deleted!!!`);
            console.log(e);
            throw e;
        }
    }

    private async generateNemesis(presetData: ConfigPreset, addresses: Addresses) {
        const target = this.params.target;
        const nemesisSeedFolder = BootstrapUtils.getTargetNemesisFolder(target, false, 'seed');

        if (presetData.nemesis) {
            await this.generateNemesisConfig(presetData, addresses);
        } else {
            const copyFrom = presetData.nemesisSeedFolder || join(this.root, 'presets', this.params.preset, 'seed');
            await BootstrapUtils.generateConfiguration({}, copyFrom, nemesisSeedFolder);
        }

        BootstrapUtils.validateFolder(nemesisSeedFolder);
        await Promise.all(
            (addresses.nodes || []).map(async (account) => {
                const name = account.name;
                const dataFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'data');
                await BootstrapUtils.generateConfiguration({}, nemesisSeedFolder, dataFolder);
            }),
        );
        return { presetData, addresses };
    }

    private async generateNodes(presetData: ConfigPreset, addresses: Addresses): Promise<void> {
        await Promise.all(
            (addresses.nodes || []).map(
                async (account, index) => await this.generateNodeConfiguration(account, index, presetData, addresses),
            ),
        );
    }
    private async generateNodeCertificates(presetData: ConfigPreset, addresses: Addresses): Promise<void> {
        await Promise.all(
            (addresses.nodes || []).map(async (account) => {
                return await new CertificateService(this.root, this.params).run(presetData, account.name, {
                    main: account.main,
                    transport: account.transport,
                });
            }),
        );
    }

    private async generateNodeConfiguration(account: NodeAccount, index: number, presetData: ConfigPreset, addresses: Addresses) {
        const copyFrom = join(this.root, 'config', 'node');
        const name = account.name;

        const outputFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'userconfig');
        const nodePreset = (presetData.nodes || [])[index];
        const generatedContext = {
            name: name,
            friendlyName: nodePreset?.friendlyName || account.friendlyName,
            harvesterSigningPrivateKey: (account.remote || account.main)?.privateKey || '',
            harvesterVrfPrivateKey: account.vrf?.privateKey || '',
        };
        const templateContext = { ...presetData, ...generatedContext, ...nodePreset };
        const excludeFiles: string[] = [];

        // Exclude files depending on the enabled extensions. To complete...
        if (!templateContext.harvesting) {
            excludeFiles.push('config-harvesting.properties');
        }
        if (!templateContext.networkheight) {
            excludeFiles.push('config-networkheight.properties');
        }

        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, outputFolder, excludeFiles);
        await this.generateP2PFile(
            presetData,
            addresses,
            outputFolder,
            NodeType.PEER_NODE,
            (nodePresetData) => nodePresetData.harvesting,
            'peers-p2p.json',
        );
        await this.generateP2PFile(
            presetData,
            addresses,
            outputFolder,
            NodeType.API_NODE,
            (nodePresetData) => nodePresetData.api,
            'peers-api.json',
        );
        await new VotingService(this.params).run(presetData, account, nodePreset);
    }

    private async generateP2PFile(
        presetData: ConfigPreset,
        addresses: Addresses,
        outputFolder: string,
        type: NodeType,
        nodePresetDataFunction: (nodePresetData: NodePreset) => boolean,
        jsonFileName: string,
    ) {
        const thisNetworkKnownPeers = (presetData.nodes || [])
            .map((nodePresetData, index) => {
                if (!nodePresetDataFunction(nodePresetData)) {
                    return undefined;
                }
                const node = (addresses.nodes || [])[index];
                return {
                    publicKey: node.main.publicKey,
                    endpoint: {
                        host: nodePresetData.host,
                        port: 7900,
                    },
                    metadata: {
                        name: nodePresetData.friendlyName,
                        roles: nodePresetData.roles,
                    },
                };
            })
            .filter((i) => i);
        const globalKnownPeers = presetData.knownPeers?.[type] || [];
        const data = {
            _info: `this file contains a list of ${type} peers`,
            knownPeers: [...thisNetworkKnownPeers, ...globalKnownPeers],
        };
        await fs.promises.writeFile(join(outputFolder, `resources`, jsonFileName), JSON.stringify(data, null, 2));
    }

    private async generateNemesisConfig(presetData: ConfigPreset, addresses: Addresses) {
        if (!presetData.nemesis) {
            throw new Error('nemesis must not be defined!');
        }
        const target = this.params.target;
        const nemesisWorkingDir = BootstrapUtils.getTargetNemesisFolder(target, false);
        const transactionsDirectory = join(nemesisWorkingDir, presetData.nemesis.transactionsDirectory || presetData.transactionsDirectory);
        await BootstrapUtils.mkdir(transactionsDirectory);
        const copyFrom = join(this.root, `config`, `nemesis`);
        const moveTo = join(nemesisWorkingDir, `userconfig`);
        const templateContext = { ...(presetData as any), addresses };
        await Promise.all(
            (addresses.nodes || []).filter((n) => n.vrf).map((n) => this.createVrfTransaction(transactionsDirectory, presetData, n)),
        );

        await Promise.all(
            (addresses.nodes || [])
                .filter((n) => n.remote)
                .map((n) => this.createAccountKeyLinkTransaction(transactionsDirectory, presetData, n)),
        );

        //Node links to main is only required when remote harvesting is on!
        await Promise.all(
            (addresses.nodes || [])
                .filter((n) => n.remote && n.transport)
                .map((n) => this.createNodeKeyLinkTransaction(transactionsDirectory, presetData, n)),
        );

        await Promise.all(
            (addresses.nodes || [])
                .filter((n) => n.voting)
                .map((n) => this.createVotingKeyTransaction(transactionsDirectory, presetData, n)),
        );

        if (presetData.nemesis.mosaics && (presetData.nemesis.transactions || presetData.nemesis.balances)) {
            logger.info('Opt In mode is ON!!! balances or transactions have been provided');
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
                                    logger.warn(`Transaction ${key} wth hash ${transactionHash} already exist. Excluded from folder.`);
                                    return undefined;
                                }
                                transactionHashes.push(transactionHash);
                                return this.storeTransaction(transactionsDirectory, key, payload);
                            })
                            .filter((p) => p),
                    )
                ).filter((p) => p);
                logger.info(`Found ${transactions.length} opted in transactions.`);
            }
            const currencyMosaic = presetData.nemesis.mosaics[0];
            const nglAccount = currencyMosaic.currencyDistributions[0];
            const originalNglAccountBalance = nglAccount.amount;
            if (!nglAccount) {
                throw Error('"NGL" account could not be found for opt in!');
            }
            let totalOptedInBalance = 0;
            if (presetData.nemesis.balances) {
                Object.entries(presetData.nemesis.balances || {}).forEach(([address, amount]) => {
                    totalOptedInBalance += amount;
                    currencyMosaic.currencyDistributions.push({ address, amount });
                });
                logger.info(
                    `Removing ${
                        Object.keys(presetData.nemesis.balances).length
                    } accounts (total of ${totalOptedInBalance}) from "ngl" account ${nglAccount.address}`,
                );
            }

            nglAccount.amount = nglAccount.amount - totalOptedInBalance;

            const providedBalances = Object.values(currencyMosaic.currencyDistributions)
                .map((d) => d.amount)
                .reduce((a, b) => a + b, 0);

            const currentBalance = providedBalances;

            if (nglAccount.amount < 1) {
                throw new Error(
                    `NGL account didn't have enough balance (${originalNglAccountBalance}) to paid all the supplied optedin namespaces and accounts of ${currentBalance}`,
                );
            }

            if (currentBalance !== currencyMosaic.supply) {
                throw new Error(
                    `Current supplied balance of ${currentBalance} is different from expected supply of ${currencyMosaic.supply}`,
                );
            }
        }

        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
        await new NemgenService(this.root, this.params).run(presetData);
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
        const account = Account.createFromPrivateKey(node.main.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
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
        const vrf = AccountKeyLinkTransaction.create(
            deadline,
            node.remote.publicKey,
            LinkAction.Link,
            presetData.networkType,
            UInt64.fromUint(0),
        );
        const account = Account.createFromPrivateKey(node.main.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `remote_${node.name}`, signedTransaction.payload);
    }

    private async createNodeKeyLinkTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.transport) {
            throw new Error('Transport keys should have been generated!!');
        }
        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const vrf = NodeKeyLinkTransaction.create(
            deadline,
            node.transport.publicKey,
            LinkAction.Link,
            presetData.networkType,
            UInt64.fromUint(0),
        );
        const account = Account.createFromPrivateKey(node.main.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `node_${node.name}`, signedTransaction.payload);
    }

    private async createVotingKeyTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.voting) {
            throw new Error('Voting keys should have been generated!!');
        }

        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const voting = BootstrapUtils.createVotingKeyTransaction(
            node.voting.publicKey,
            UInt64.fromUint(0),
            presetData,
            Deadline.createFromDTO('1'),
            UInt64.fromUint(0),
        );
        const account = Account.createFromPrivateKey(node.main.privateKey, presetData.networkType);
        const signedTransaction = account.sign(voting, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `voting_${node.name}`, signedTransaction.payload);
    }

    private async storeTransaction(transactionsDirectory: string, name: string, payload: string): Promise<Transaction> {
        const transaction = TransactionMapping.createFromPayload(payload);
        await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, Convert.hexToUint8(payload));
        return transaction as Transaction;
    }

    private generateGateways(presetData: ConfigPreset) {
        return Promise.all(
            (presetData.gateways || []).map(async (gatewayPreset, index: number) => {
                const copyFrom = join(this.root, 'config', 'rest-gateway');
                const templateContext = { ...presetData, ...gatewayPreset };
                const name = templateContext.name || `rest-gateway-${index}`;
                const moveTo = BootstrapUtils.getTargetGatewayFolder(this.params.target, false, name);
                await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
                const apiNodeConfigFolder = BootstrapUtils.getTargetNodesFolder(
                    this.params.target,
                    false,
                    gatewayPreset.apiNodeName,
                    'userconfig',
                    'resources',
                );
                await BootstrapUtils.generateConfiguration({}, apiNodeConfigFolder, join(moveTo, 'api-node-config'));
            }),
        );
    }

    private generateExplorers(presetData: ConfigPreset) {
        return Promise.all(
            (presetData.explorers || []).map(async (explorerPreset, index: number) => {
                const copyFrom = join(this.root, 'config', 'explorer');
                const templateContext = { ...presetData, ...explorerPreset };
                const name = templateContext.name || `explorer-${index}`;
                const moveTo = BootstrapUtils.getTargetFolder(this.params.target, false, BootstrapUtils.targetExplorersFolder, name);
                await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
            }),
        );
    }

    private generateWallets(presetData: ConfigPreset) {
        return Promise.all(
            (presetData.wallets || []).map(async (explorerPreset, index: number) => {
                const copyFrom = join(this.root, 'config', 'wallet');
                const templateContext = { ...presetData, ...explorerPreset };
                const name = templateContext.name || `wallet-${index}`;
                const moveTo = BootstrapUtils.getTargetFolder(this.params.target, false, BootstrapUtils.targetWalletsFolder, name);
                await BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
                await Promise.all(
                    (explorerPreset.profiles || []).map(async (profile) => {
                        if (!profile.name) {
                            throw new Error('Profile`s name must be provided in the wallets preset when creating wallet profiles.');
                        }
                        const profileJsonFileName = `wallet-profile-${profile.name}.json`;

                        const loadProfileData = async (): Promise<string> => {
                            if (profile.data) {
                                return JSON.stringify(profile.data, null, 2);
                            }
                            if (profile.location) {
                                return BootstrapUtils.loadFileAsText(profile.location);
                            }
                            return BootstrapUtils.loadFileAsText(profileJsonFileName);
                        };

                        try {
                            const profileData = await loadProfileData();
                            await BootstrapUtils.writeTextFile(join(moveTo, profileJsonFileName), profileData);
                        } catch (e) {
                            const message = `Cannot create Wallet profile with name '${profile.name}'. Do you have the file '${profileJsonFileName}' in the current folder?. ${e}`;
                            throw new Error(message);
                        }
                    }),
                );
            }),
        );
    }

    private cleanUpConfiguration(presetData: ConfigPreset) {
        (presetData.nodes || []).forEach((gateway) => {
            const configFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, gateway.name, 'userconfig');
            BootstrapUtils.deleteFolder(configFolder);
        });
        (presetData.gateways || []).forEach((node) => {
            const configFolder = BootstrapUtils.getTargetGatewayFolder(this.params.target, false, node.name);
            BootstrapUtils.deleteFolder(configFolder);
        });
    }
}
