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
    Address,
    Convert,
    Deadline,
    LinkAction,
    MosaicId,
    MosaicNonce,
    NetworkType,
    Transaction,
    TransactionMapping,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { Addresses, ConfigAccount, ConfigPreset, MosaicAccounts, NodeAccount, NodePreset, NodeType } from '../model';
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
        user: BootstrapUtils.CURRENT_USER,
    };

    constructor(private readonly root: string, private readonly params: ConfigParams) {}

    public static getNetworkIdentifier(networkType: NetworkType): string {
        switch (networkType) {
            case NetworkType.MAIN_NET:
                return 'public';
            case NetworkType.TEST_NET:
                return 'public-test';
            case NetworkType.MIJIN:
                return 'mijin';
            case NetworkType.MIJIN_TEST:
                return 'mijin-test';
        }
        throw new Error(`Invalid Network Type ${networkType}`);
    }

    public static getNetworkName(networkType: NetworkType): string {
        switch (networkType) {
            case NetworkType.MAIN_NET:
                return 'public';
            case NetworkType.TEST_NET:
                return 'publicTest';
            case NetworkType.MIJIN:
                return 'mijin';
            case NetworkType.MIJIN_TEST:
                return 'mijinTest';
        }
        throw new Error(`Invalid Network Type ${networkType}`);
    }

    public generateAddresses(networkType: NetworkType, size: number): ConfigAccount[] {
        return ConfigService.getArray(size).map(() => ConfigLoader.toConfig(Account.generateNewAccount(networkType)));
    }

    public generateAccount(networkType: NetworkType, privateKey: string | undefined): Account {
        return privateKey ? Account.createFromPrivateKey(privateKey, networkType) : Account.generateNewAccount(networkType);
    }

    public generateNodeAccount(presetData: ConfigPreset, index: number, nodePreset: NodePreset, networkType: NetworkType): NodeAccount {
        const name = nodePreset.name || `node-${index}`;
        const ca = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.caPrivateKey));
        const node = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.nodePrivateKey));

        const friendlyName = nodePreset.friendlyName || ca.publicKey.substr(0, 7);
        const nodeAccount: NodeAccount = { name, friendlyName, roles: nodePreset.roles, ca, node };

        const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;

        if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.harvesterSigning = ConfigLoader.toConfig(this.generateAccount(networkType, nodePreset.harvesterSigningPrivateKey));

        if (!useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.harvesterSigning = ConfigLoader.toConfig(
                this.generateAccount(networkType, nodePreset.harvesterSigningPrivateKey || ca.privateKey),
            );

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

    public async run(): Promise<ConfigResult> {
        const target = this.params.target;
        try {
            if (this.params.reset) {
                BootstrapUtils.deleteFolder(target);
            }
            const presetLocation = ConfigLoader.getGeneratedPresetLocation(target);
            if (fs.existsSync(presetLocation) && !this.params.upgrade) {
                logger.info(
                    `The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset or --upgrade to upgrade)`,
                );
                const presetData = ConfigLoader.loadExistingPresetData(target);
                const addresses = ConfigLoader.loadExistingAddresses(target);
                if (this.params.report) {
                    await new ReportService(this.root, this.params).run(presetData);
                }
                await BootstrapUtils.writeYaml(ConfigLoader.getGeneratedAddressLocation(target), addresses);
                await BootstrapUtils.writeYaml(presetLocation, presetData);
                return { presetData, addresses };
            }
            if (this.params.upgrade) {
                logger.info('Upgrading configuration...');
            }

            const oldPresetData = ConfigLoader.loadExistingPresetDataIfPreset(target);
            const oldAddresses = ConfigLoader.loadExistingAddressesIfPreset(target);

            const presetData: ConfigPreset = _.merge(
                oldPresetData || {},
                ConfigLoader.createPresetData(
                    this.root,
                    this.params.preset,
                    this.params.assembly,
                    this.params.customPreset,
                    this.params.customPresetObject,
                ),
            );

            await BootstrapUtils.pullImage(presetData.symbolServerToolsImage);
            const addresses = _.merge(await this.generateRandomConfiguration(presetData), oldAddresses || {});

            await BootstrapUtils.mkdir(target);

            this.cleanUpConfiguration(presetData);

            await this.generateNodeCertificates(presetData, addresses);
            await this.generateNodes(presetData, addresses);
            await this.generateGateways(presetData);
            if (!oldPresetData && !oldAddresses) {
                await this.generateNemesis(presetData, addresses);
            } else {
                logger.info('Nemesis data cannot be generated or copied when upgrading...');
            }

            if (this.params.report) {
                await new ReportService(this.root, this.params).run(presetData);
            }

            await BootstrapUtils.writeYaml(ConfigLoader.getGeneratedAddressLocation(target), addresses);
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

    private async generateRandomConfiguration(presetData: ConfigPreset): Promise<Addresses> {
        const networkType = presetData.networkType;
        const addresses: Addresses = {
            version: ConfigLoader.getAddressesMigration(presetData.networkType).length + 1,
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

        presetData.networkIdentifier = ConfigService.getNetworkIdentifier(presetData.networkType);
        presetData.networkName = ConfigService.getNetworkName(presetData.networkType);
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
                        const caNodes = (addresses.nodes || []).filter((node) => node.ca);
                        const totalAccounts = (m.accounts || 0) + caNodes.length;
                        const amountPerAccount = Math.floor(m.supply / totalAccounts);
                        m.currencyDistributions = [
                            ...accounts.map((a) => ({ address: a.address, amount: amountPerAccount })),
                            ...caNodes.map((n) => ({ address: n.ca!.address, amount: amountPerAccount })),
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
                    ca: account.ca,
                    node: account.node,
                });
            }),
        );
    }

    private async generateNodeConfiguration(account: NodeAccount, index: number, presetData: ConfigPreset, addresses: Addresses) {
        const copyFrom = join(this.root, 'config', 'node');
        const name = account.name;

        const outputFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'userconfig');
        const nodePreset = (presetData.nodes || [])[index];
        const beneficiaryAddress = this.resolveBeneficiaryAddress(account, presetData);
        const generatedContext = {
            name: name,
            beneficiaryAddress,
            friendlyName: nodePreset?.friendlyName || account.friendlyName,
            harvesterSigningPrivateKey: account.harvesterSigning?.privateKey || '',
            harvesterVrfPrivateKey: account.vrf?.privateKey || '',
        };
        const templateContext = { ...presetData, ...generatedContext, ...nodePreset };
        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, outputFolder);
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

    private resolveBeneficiaryAddress(account: NodeAccount, presetData: ConfigPreset) {
        let beneficiaryAddress = account.beneficiaryAddress || presetData.beneficiaryAddress || '';
        if (
            beneficiaryAddress === '' &&
            account.harvesterSigning &&
            account.harvesterSigning.privateKey.toUpperCase() != account.ca.privateKey.toUpperCase()
        ) {
            beneficiaryAddress = account.ca.address;
        }
        return beneficiaryAddress;
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
                    publicKey: node.ca.publicKey,
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
                .filter((n) => n.harvesterSigning && n.harvesterSigning.privateKey.toUpperCase() !== n.ca.privateKey.toUpperCase())
                .map((n) => this.createAccountKeyLinkTransaction(transactionsDirectory, presetData, n)),
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
        if (!node.ca) {
            throw new Error('Signing keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const vrf = VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, LinkAction.Link, presetData.networkType, UInt64.fromUint(0));
        const account = Account.createFromPrivateKey(node.ca.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
    }

    private async createAccountKeyLinkTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.harvesterSigning) {
            throw new Error('Harvester Signing keys should have been generated!!');
        }
        if (!node.ca) {
            throw new Error('Signing keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const vrf = AccountKeyLinkTransaction.create(
            deadline,
            node.harvesterSigning.publicKey,
            LinkAction.Link,
            presetData.networkType,
            UInt64.fromUint(0),
        );
        const account = Account.createFromPrivateKey(node.ca.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `remote_${node.name}`, signedTransaction.payload);
    }

    private async createVotingKeyTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.voting) {
            throw new Error('Voting keys should have been generated!!');
        }

        if (!node.ca) {
            throw new Error('Signing keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const votingKey = BootstrapUtils.createVotingKey(node.voting.publicKey);
        const voting = VotingKeyLinkTransaction.create(
            deadline,
            votingKey,
            presetData.votingKeyStartEpoch,
            presetData.votingKeyEndEpoch,
            LinkAction.Link,
            presetData.networkType,
            UInt64.fromUint(0),
        );
        const account = Account.createFromPrivateKey(node.ca.privateKey, presetData.networkType);
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
