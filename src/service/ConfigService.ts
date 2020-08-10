// eslint-disable-next-line @typescript-eslint/no-var-requires
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
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { CertificateService } from './CertificateService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { NemgenService } from './NemgenService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

export interface ConfigParams {
    root: string;
    reset: boolean;
    preset: string;
    target: string;
    assembly?: string;
    customPreset?: string;
}

export interface MosaicPreset {
    name: string;
    divisibility: number;
    duration: number;
    supply: number;
    isTransferable: boolean;
    isSupplyMutable: boolean;
    isRestrictable: boolean;
    accounts: number;
    currencyDistributions: { address: string; amount: number }[];
}

export interface DatabasePreset {
    name: string;
    openPort: boolean;
}

export enum NodeType {
    PEER_NODE = 'peer-node',
    API_NODE = 'api-node',
}

export interface ConfigPreset {
    nemgen: boolean;
    assemblies?: string;
    nemesisSignerPublicKey: string;
    nemesisGenerationHashSeed: string;
    transactionsDirectory: string;
    nodes?: any[];
    gateways?: any[];
    networkType: NetworkType;
    networkIdentifier: string;
    networkName: string;
    currencyMosaicId: string;
    harvestingMosaicId: string;
    nemesisSignerPrivateKey: string;
    binDirectory: string;
    baseNamespace: string;
    symbolServerToolsImage: string;
    symbolServerImage: string;
    symbolRestImage: string;
    mongoImage: string;
    databases?: DatabasePreset[];
    mosaics?: MosaicPreset[];
    transactions?: Record<string, string>;
    balances?: Record<string, number>;
    knownPeers?: Record<NodeType, any[]>;
}

export interface CertificatePair {
    privateKey: string;
    publicKey: string;
}

export interface ConfigAccount extends CertificatePair {
    address: string;
}

export interface NodeAccount {
    signing: ConfigAccount;
    ssl: CertificatePair;
    type: NodeType;
    vrf: ConfigAccount;
    name: string;
    friendlyName: string;
}

export interface ConfigAddresses {
    nodes?: NodeAccount[];
    gateways?: ConfigAccount[];
    nemesisGenerationHashSeed: string;
    nemesisSigner?: ConfigAccount;
    networkType: NetworkType;
    mosaics?: Record<string, ConfigAccount[]>;
}

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ConfigService {
    public static defaultParams: ConfigParams = { target: 'target', preset: 'bootstrap', reset: false, root: '.' };

    constructor(private readonly params: ConfigParams = ConfigService.defaultParams) {}

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

    public async generateNodeAccount(index: number, node: any, networkType: NetworkType): Promise<NodeAccount> {
        const type = node.type;
        const name = node.name || `${type}-${index}`;
        const signing = this.toConfig(Account.generateNewAccount(networkType));
        const vrf = this.toConfig(Account.generateNewAccount(networkType));
        const ssl = await new CertificateService(this.params).run(name);
        const friendlyName = node.fieldName || ssl.publicKey.substr(0, 7);
        return { signing, vrf, ssl, type, name, friendlyName };
    }

    public async generateNodeAccounts(networkType: NetworkType, nodes: any[]): Promise<NodeAccount[]> {
        return Promise.all(
            nodes.map((node, index) => {
                return this.generateNodeAccount(index, node, networkType);
            }),
        );
    }

    public generateAddress(networkType: NetworkType): ConfigAccount {
        return this.toConfig(Account.generateNewAccount(networkType));
    }

    private static getArray(size: number): number[] {
        return [...Array(size).keys()];
    }

    public async run(): Promise<void> {
        const presetData: ConfigPreset = BootstrapUtils.loadPresetData(
            this.params.root,
            this.params.preset,
            this.params.assembly,
            this.params.customPreset,
        );
        const configFolder = `${this.params.target}/config`;

        if (this.params.reset) {
            logger.info('Deleting config folder');
            BootstrapUtils.deleteFolderRecursive(configFolder);
        }
        if (fs.existsSync(configFolder)) {
            logger.info('Config folder exist, ignoring configuration. (run -r to reset)');
            return;
        }

        await fs.promises.mkdir(`${this.params.target}/config/generated-addresses`, { recursive: true });
        const networkType = presetData.networkType;
        const addresses = await this.generateRandomConfiguration(networkType, presetData);
        this.completePresetDataWithRandomConfiguration(presetData, addresses, networkType);
        await BootstrapUtils.writeYaml(`${this.params.target}/config/generated-addresses/addresses.yml`, addresses);

        await this.generateNodes(presetData, addresses);
        await this.generateGateways(presetData, addresses);
        await BootstrapUtils.mkdir(`${this.params.target}/data/nemesis-data/seed/00000`);
        if (presetData.nemgen) {
            await this.generateNemesisConfig(presetData, addresses);
        } else {
            const copyFrom = `${this.params.root}/presets/${this.params.preset}/seed`;
            const copyTo = `${this.params.target}/data/nemesis-data/seed`;
            await BootstrapUtils.generateConfiguration({}, copyFrom, copyTo);
        }

        await BootstrapUtils.writeYaml(`${this.params.target}/config/preset.yml`, presetData);

        logger.info(`Configuration generated.`);
    }

    private completePresetDataWithRandomConfiguration(
        presetData: ConfigPreset,
        addresses: ConfigAddresses,
        networkType: NetworkType,
    ): void {
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
            if (presetData.mosaics && presetData.mosaics.length > 1) {
                presetData.harvestingMosaicId = BootstrapUtils.toHex(
                    MosaicId.createFromNonce(MosaicNonce.createFromNumber(1), ownerAddress).toHex(),
                );
            } else {
                presetData.harvestingMosaicId = presetData.currencyMosaicId;
            }
        }
    }

    private async generateRandomConfiguration(networkType: NetworkType, presetData: ConfigPreset): Promise<ConfigAddresses> {
        const addresses: ConfigAddresses = {
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

        if (presetData.nemgen) {
            addresses.nemesisSigner = this.generateAddress(networkType);
        }

        if (!presetData.nemesisSignerPrivateKey && addresses.nemesisSigner) {
            presetData.nemesisSignerPrivateKey = addresses.nemesisSigner.privateKey;
        }

        if (!presetData.nemesisSignerPublicKey && addresses.nemesisSigner) {
            presetData.nemesisSignerPublicKey = addresses.nemesisSigner.publicKey;
        }

        if (presetData.mosaics) {
            const mosaics: Record<string, ConfigAccount[]> = {};
            presetData.mosaics.forEach((m) => {
                mosaics[m.name] = this.generateAddresses(networkType, m.accounts);
            });

            presetData.mosaics.forEach((m) => {
                const accounts = mosaics[m.name];
                if (!m.currencyDistributions) {
                    m.currencyDistributions = accounts.map((a) => {
                        return { address: a.address, amount: m.supply / m.accounts };
                    });
                }
            });
            addresses.mosaics = mosaics;
        }
        return addresses;
    }

    private async generateNodes(presetData: ConfigPreset, addresses: ConfigAddresses) {
        await Promise.all(
            (addresses.nodes || []).map(async (account, index) => {
                await this.generateNodeConfiguration(account, index, presetData, addresses);
            }),
        );
    }

    private async generateNodeConfiguration(account: NodeAccount, index: number, presetData: ConfigPreset, addresses: ConfigAddresses) {
        const copyFrom = `${this.params.root}/config/node`;
        const name = account.name;
        const outputFolder = `${this.params.target}/config/${name}`;
        const nodePreset = (presetData.nodes || [])[index];
        const generatedContext = {
            name: name,
            friendlyName: nodePreset?.friendlyName || account.friendlyName,
            harvesterSigningPrivateKey: account.signing.privateKey,
            harvesterVrfPrivateKey: account.vrf.privateKey,
        };
        const templateContext: any = { ...presetData, ...generatedContext, ...nodePreset };
        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, outputFolder);
        await this.generateP2PFile(presetData, addresses, outputFolder, NodeType.PEER_NODE, 'peers-p2p.json');
        await this.generateP2PFile(presetData, addresses, outputFolder, NodeType.API_NODE, 'peers-api.json');
    }

    private async generateP2PFile(
        presetData: ConfigPreset,
        addresses: ConfigAddresses,
        outputFolder: string,
        type: NodeType,
        jsonFileName: string,
    ) {
        const thisNetworkKnownPeers = (addresses.nodes || [])
            .map((node, index) => {
                if (node.type !== type) {
                    return undefined;
                }
                const nodePresetData = (presetData.nodes || [])[index];
                const name = node.name;
                return {
                    publicKey: node.ssl.publicKey,
                    endpoint: {
                        host: name,
                        port: 7900,
                    },
                    metadata: {
                        name: name,
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
        await fs.promises.writeFile(outputFolder + '/resources/' + jsonFileName, JSON.stringify(data, null, 2));
    }

    private async generateNemesisConfig(presetData: ConfigPreset, addresses: ConfigAddresses) {
        const transactionDirectory = `${this.params.target}/config${presetData.transactionsDirectory}`;
        await BootstrapUtils.mkdir(transactionDirectory);
        const copyFrom = `${this.params.root}/config/nemesis`;
        const moveTo = `${this.params.target}/config/nemesis`;
        const templateContext = { ...(presetData as any), addresses };
        await Promise.all((addresses.nodes || []).map((n) => this.createVrfTransaction(presetData, n)));

        //OPT IN!!
        // const namespacesBalances =
        //     storedTransactions
        //         .filter((t) => t.type === TransactionType.NAMESPACE_REGISTRATION)
        //         .map((t) => {
        //             const namespaceTransaction = t as NamespaceRegistrationTransaction;
        //             return parseInt(namespaceTransaction?.duration?.toString() || '0');
        //         })
        //         .reduce((p, n) => {
        //             return p + n;
        //         }, 0) || 0;
        if (presetData.mosaics && (presetData.transactions || presetData.balances)) {
            logger.info('Opt In mode is ON!!! balances or transactions have been provided');
            if (presetData.transactions) {
                const transactionHashes: string[] = [];
                const transactions = (
                    await Promise.all(
                        Object.entries(presetData.transactions || {})
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
                                return this.storeTransaction(presetData, key, payload);
                            })
                            .filter((p) => p),
                    )
                ).filter((p) => p);
                logger.info(`Found ${transactions.length} opted in transactions.`);
            }
            const currencyMosaic = presetData.mosaics[0];
            const nglAccount = currencyMosaic.currencyDistributions[0];
            const originalNglAccountBalance = nglAccount.amount;
            if (!nglAccount) {
                throw Error('"NGL" account could not be found for opt in!');
            }
            // if (namespacesBalances) {
            //     logger.info(`Removing namespace duration ${namespacesBalances} from "ngl" account ${namespacesBalances}`);
            // }
            let totalOptedInBalance = 0;
            if (presetData.balances) {
                Object.entries(presetData.balances || {}).forEach(([address, amount]) => {
                    totalOptedInBalance += amount;
                    currencyMosaic.currencyDistributions.push({ address, amount });
                });
                logger.info(
                    `Removing ${Object.keys(presetData.balances).length} accounts (total of ${totalOptedInBalance}) from "ngl" account ${
                        nglAccount.address
                    }`,
                );
            }

            nglAccount.amount = nglAccount.amount - totalOptedInBalance;

            const providedBalances = Object.values(currencyMosaic.currencyDistributions)
                .map((d) => d.amount)
                .reduce((a, b) => a + b, 0);

            const currentBalance = providedBalances;
            // console.log('supply', currencyMosaic.supply);
            // console.log('providedBalances', providedBalances);
            // console.log('namespacesBalances', namespacesBalances);
            // console.log('currentBalance', currentBalance);

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
        await new NemgenService(this.params).run(presetData.networkIdentifier, presetData.symbolServerToolsImage);
    }

    private async createVrfTransaction(presetData: ConfigPreset, node: NodeAccount): Promise<Transaction> {
        const deadline = (Deadline as any)['createFromDTO']('1');
        const vrf = VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, LinkAction.Link, presetData.networkType, UInt64.fromUint(0));
        const account = Account.createFromPrivateKey(node.signing.privateKey, presetData.networkType);
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return await this.storeTransaction(presetData, `vrf_${node.name}`, signedTransaction.payload);
    }

    private async storeTransaction(presetData: ConfigPreset, name: string, payload: string): Promise<Transaction> {
        const transaction = TransactionMapping.createFromPayload(payload);
        const transactionsDirectory = `${this.params.target}/config${presetData.transactionsDirectory}`;
        await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, Convert.hexToUint8(payload));
        return transaction as Transaction;
    }

    private generateGateways(presetData: ConfigPreset, addresses: ConfigAddresses) {
        return Promise.all(
            (addresses.gateways || []).map((account, index: number) => {
                const copyFrom = `${this.params.root}/config/rest-gateway`;

                const generatedContext = {
                    restPrivateKey: account.privateKey,
                };
                const gatewayPreset = (presetData.gateways || [])[index];
                const templateContext: any = { ...presetData, ...generatedContext, ...gatewayPreset };
                const name = templateContext.name || `rest-gateway-${index}`;
                const moveTo = `${this.params.target}/config/${name}`;
                return BootstrapUtils.generateConfiguration(templateContext, copyFrom, moveTo);
            }),
        );
    }
}
