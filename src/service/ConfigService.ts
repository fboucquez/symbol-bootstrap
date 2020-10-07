import { BootstrapUtils } from './BootstrapUtils';
import {
    Account,
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
import { CertificateService } from './CertificateService';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { NemgenService } from './NemgenService';
import { Addresses, ConfigAccount, ConfigPreset, NodeAccount, NodePreset, NodeType } from '../model';
import * as fs from 'fs';
import { VotingService } from './VotingService';
import { join } from 'path';
import { ReportService } from './ReportService';

/**
 * Defined presets.
 */
export enum Preset {
    bootstrap = 'bootstrap',
    testnet = 'testnet',
    light = 'light',
}

export interface ConfigParams {
    report: boolean;
    reset: boolean;
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
        target: 'target',
        report: false,
        preset: Preset.bootstrap,
        reset: false,
        user: BootstrapUtils.CURRENT_USER,
    };

    constructor(private readonly root: string, private readonly params: ConfigParams) {}

    public toConfig(account: Account): ConfigAccount {
        return {
            privateKey: account.privateKey,
            publicKey: account.publicAccount.publicKey,
            address: account.address.plain(),
        };
    }

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
        return ConfigService.getArray(size).map(() => this.toConfig(Account.generateNewAccount(networkType)));
    }

    public generateAccount(networkType: NetworkType, privateKey: string | undefined): Account {
        return privateKey ? Account.createFromPrivateKey(privateKey, networkType) : Account.generateNewAccount(networkType);
    }

    public async generateNodeAccount(index: number, node: NodePreset, networkType: NetworkType): Promise<NodeAccount> {
        const name = node.name || `node-${index}`;
        const ssl = await new CertificateService(this.root, this.params).run(name);
        const friendlyName = node.friendlyName || ssl.publicKey.substr(0, 7);
        const nodeAccount: NodeAccount = { name, friendlyName, roles: node.roles, ssl };

        if (node.harvesting || node.voting) nodeAccount.signing = this.toConfig(this.generateAccount(networkType, node.signingPrivateKey));
        if (node.voting) nodeAccount.voting = this.toConfig(this.generateAccount(networkType, node.votingPrivateKey));
        if (node.harvesting) nodeAccount.vrf = this.toConfig(this.generateAccount(networkType, node.vrfPrivateKey));
        return nodeAccount;
    }

    public async generateNodeAccounts(networkType: NetworkType, nodes: NodePreset[]): Promise<NodeAccount[]> {
        return Promise.all(nodes.map((node, index) => this.generateNodeAccount(index, node, networkType)));
    }

    private static getArray(size: number): number[] {
        return [...Array(size).keys()];
    }

    public async run(): Promise<ConfigResult> {
        const target = this.params.target;
        if (this.params.reset) {
            BootstrapUtils.deleteFolder(target);
        }
        const presetLocation = BootstrapUtils.getGeneratedPresetLocation(target);
        if (fs.existsSync(presetLocation)) {
            logger.info(`The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset)`);
            const presetData: ConfigPreset = BootstrapUtils.loadExistingPresetData(target);
            const addresses: Addresses = BootstrapUtils.loadExistingAddresses(target);
            return { presetData, addresses };
        }

        const presetData: ConfigPreset = BootstrapUtils.loadPresetData(
            this.root,
            this.params.preset,
            this.params.assembly,
            this.params.customPreset,
            this.params.customPresetObject,
        );

        await BootstrapUtils.pullImage(presetData.symbolServerToolsImage);

        const networkType = presetData.networkType;
        const addresses = await this.generateRandomConfiguration(networkType, presetData);
        this.completePresetDataWithRandomConfiguration(presetData, addresses, networkType);
        await BootstrapUtils.writeYaml(BootstrapUtils.getGeneratedAddressLocation(target), addresses);

        await this.generateNodes(presetData, addresses);
        await this.generateNemesis(presetData, addresses);
        await this.generateGateways(presetData, addresses);

        await BootstrapUtils.writeYaml(presetLocation, presetData);
        logger.info(`Configuration generated.`);
        return { presetData, addresses };
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

        if (this.params.report) {
            await new ReportService(this.root, this.params).run(presetData);
        }
        BootstrapUtils.validateFolder(nemesisSeedFolder);
        await Promise.all(
            (addresses.nodes || []).map(async (account) => {
                const name = account.name;
                const dataFolder = BootstrapUtils.getTargetNodesFolder(target, false, name, 'data');
                await BootstrapUtils.generateConfiguration({}, nemesisSeedFolder, dataFolder);
            }),
        );
        await BootstrapUtils.writeYaml(BootstrapUtils.getGeneratedPresetLocation(target), presetData);
        logger.info(`Configuration generated.`);
        return { presetData, addresses };
    }

    private completePresetDataWithRandomConfiguration(presetData: ConfigPreset, addresses: Addresses, networkType: NetworkType): void {
        presetData.networkIdentifier = ConfigService.getNetworkIdentifier(presetData.networkType);
        presetData.networkName = ConfigService.getNetworkName(presetData.networkType);
        if (!presetData.nemesisGenerationHashSeed) {
            presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        }

        //How can it work?
        const ownerAddress = Address.createFromPublicKey(presetData.nemesisSignerPublicKey, networkType);

        if (!presetData.currencyMosaicId)
            presetData.currencyMosaicId = BootstrapUtils.toHex(
                MosaicId.createFromNonce(MosaicNonce.createFromNumber(0), ownerAddress).toHex(),
            );
        if (!presetData.harvestingMosaicId) {
            if (!presetData.nemesis) {
                throw new Error('nemesis must be defined!');
            }
            if (presetData.nemesis.mosaics && presetData.nemesis.mosaics.length > 1) {
                presetData.harvestingMosaicId = BootstrapUtils.toHex(
                    MosaicId.createFromNonce(MosaicNonce.createFromNumber(1), ownerAddress).toHex(),
                );
            } else {
                presetData.harvestingMosaicId = presetData.currencyMosaicId;
            }
        }
    }

    private async generateRandomConfiguration(networkType: NetworkType, presetData: ConfigPreset): Promise<Addresses> {
        const addresses: Addresses = {
            networkType: networkType,
            nemesisGenerationHashSeed:
                presetData.nemesisGenerationHashSeed || Account.generateNewAccount(networkType).publicAccount.publicKey,
        };

        if (presetData.nodes) {
            addresses.nodes = await this.generateNodeAccounts(networkType, presetData.nodes);
        }

        if (presetData.gateways) {
            addresses.gateways = this.generateAddresses(networkType, presetData.gateways.length);
        }
        if (presetData.nemesis) {
            addresses.nemesisSigner = this.toConfig(this.generateAccount(networkType, presetData.nemesis.nemesisSignerPrivateKey));

            if (!presetData.nemesis.nemesisSignerPrivateKey && addresses.nemesisSigner) {
                presetData.nemesis.nemesisSignerPrivateKey = addresses.nemesisSigner.privateKey;
            }
            if (presetData.nemesis.mosaics) {
                const mosaics: Record<string, ConfigAccount[]> = {};
                presetData.nemesis.mosaics.forEach((m) => {
                    mosaics[m.name] = this.generateAddresses(networkType, m.accounts);
                });

                presetData.nemesis.mosaics.forEach((m) => {
                    const accounts = mosaics[m.name];
                    if (!m.currencyDistributions) {
                        const signingNodes = (addresses.nodes || []).filter((node) => node.signing);
                        const totalAccounts = (m.accounts || 0) + signingNodes.length;
                        const amountPerAccount = Math.floor(m.supply / totalAccounts);
                        m.currencyDistributions = [
                            ...accounts.map((a) => ({ address: a.address, amount: amountPerAccount })),
                            ...signingNodes.map((n) => ({ address: n.signing!.address, amount: amountPerAccount })),
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

        if (!presetData.nemesisSignerPublicKey && addresses.nemesisSigner) {
            presetData.nemesisSignerPublicKey = addresses.nemesisSigner.publicKey;
        }

        return addresses;
    }

    private async generateNodes(presetData: ConfigPreset, addresses: Addresses) {
        await Promise.all(
            (addresses.nodes || []).map(
                async (account, index) => await this.generateNodeConfiguration(account, index, presetData, addresses),
            ),
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
            harvesterSigningPrivateKey: account.signing?.privateKey || '',
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
                    publicKey: node.ssl.publicKey,
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
        if (!node.signing) {
            throw new Error('Signing keys should have been generated!!');
        }
        const deadline = Deadline.createFromDTO('1');
        const vrf = VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, LinkAction.Link, presetData.networkType, UInt64.fromUint(0));
        const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
    }

    private async createVotingKeyTransaction(
        transactionsDirectory: string,
        presetData: ConfigPreset,
        node: NodeAccount,
    ): Promise<Transaction> {
        if (!node.voting) {
            throw new Error('Voting keys should have been generated!!');
        }

        if (!node.signing) {
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
        const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
        const signedTransaction = account.sign(voting, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(transactionsDirectory, `voting_${node.name}`, signedTransaction.payload);
    }

    private async storeTransaction(transactionsDirectory: string, name: string, payload: string): Promise<Transaction> {
        const transaction = TransactionMapping.createFromPayload(payload);
        await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, Convert.hexToUint8(payload));
        return transaction as Transaction;
    }

    private generateGateways(presetData: ConfigPreset, addresses: Addresses) {
        return Promise.all(
            (addresses.gateways || []).map(async (account, index: number) => {
                const copyFrom = join(this.root, 'config', 'rest-gateway');

                const generatedContext = {
                    restPrivateKey: account.privateKey,
                };
                const gatewayPreset = (presetData.gateways || [])[index];
                const templateContext = { ...presetData, ...generatedContext, ...gatewayPreset };
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
}
