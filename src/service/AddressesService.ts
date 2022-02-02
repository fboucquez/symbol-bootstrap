import { Account, Address, Convert, Crypto, MosaicId, MosaicNonce, NetworkType, PublicAccount } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigAccount, ConfigPreset, MosaicAccounts, NodeAccount, NodePreset, PrivateKeySecurityMode } from '../model';
import { AccountResolver } from './AccountResolver';
import { KeyName } from './ConfigService';
import { ConfigurationUtils } from './ConfigurationUtils';
import { CryptoUtils } from './CryptoUtils';
import { MigrationService } from './MigrationService';
import { Utils } from './Utils';
import { YamlUtils } from './YamlUtils';

/**
 * Object in charge of resolving the address.yml and its accounts.
 */
export class AddressesService {
    private readonly migrationService: MigrationService;
    constructor(private readonly logger: Logger, private readonly accountResolver: AccountResolver) {
        this.migrationService = new MigrationService(this.logger);
    }

    public async resolveAddresses(
        oldAddresses: Addresses | undefined,
        oldPresetData: ConfigPreset | undefined,
        presetData: ConfigPreset,
    ): Promise<Addresses> {
        const networkType = presetData.networkType;
        const addresses: Addresses = {
            version: this.migrationService.getAddressesMigration(presetData.networkType).length + 1,
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

        if (!presetData.harvestNetworkFeeSinkAddressV1) {
            presetData.harvestNetworkFeeSinkAddressV1 = presetData.harvestNetworkFeeSinkAddress;
        }
        if (!presetData.mosaicRentalFeeSinkAddressV1) {
            presetData.mosaicRentalFeeSinkAddressV1 = presetData.mosaicRentalFeeSinkAddress;
        }
        if (!presetData.namespaceRentalFeeSinkAddressV1) {
            presetData.namespaceRentalFeeSinkAddressV1 = presetData.namespaceRentalFeeSinkAddress;
        }
        presetData.networkIdentifier = Utils.getNetworkIdentifier(networkType);
        presetData.networkName = Utils.getNetworkName(networkType);
        presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        addresses.nodes = await this.resolveNodesAccounts(oldAddresses, presetData, networkType);

        const shouldCreateNemesis = ConfigurationUtils.shouldCreateNemesis(presetData);
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
    private sum(distribution: { amount: number; address: string }[], mosaicName: string) {
        return distribution
            .map((d, index) => {
                if (d.amount < 0) {
                    throw new Error(
                        `Nemesis distribution balance cannot be less than 0. Mosaic ${mosaicName}, distribution address: ${
                            d.address
                        }, amount: ${d.amount}, index ${index}. \nDistributions are:\n${YamlUtils.toYaml(distribution)}`,
                    );
                }
                return d.amount;
            })
            .reduce((a, b) => a + b, 0);
    }

    private resolveNemesisAccount(presetData: ConfigPreset, oldAddresses: Addresses | undefined): ConfigAccount {
        const networkType = presetData.networkType;
        const signerPrivateKey =
            presetData.nemesis.nemesisSignerPrivateKey ||
            oldAddresses?.nemesisSigner?.privateKey ||
            Account.generateNewAccount(networkType).privateKey;

        const signerPublicKey = presetData.nemesisSignerPublicKey || oldAddresses?.nemesisSigner?.publicKey;
        const nemesisSigner = ConfigurationUtils.toConfigAccountFomKeys(networkType, signerPublicKey, signerPrivateKey);

        if (!nemesisSigner) {
            throw new Error('Nemesis Signer should be resolved!');
        }
        return nemesisSigner;
    }

    private processNemesisBalances(presetData: ConfigPreset, addresses: Addresses, nemesisSignerAddress: Address): MosaicAccounts[] {
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const networkType = presetData.networkType;
        const mosaics: MosaicAccounts[] = [];
        presetData.nemesis.mosaics.forEach((m, mosaicIndex) => {
            const accounts = this.generateAddresses(networkType, privateKeySecurityMode, m.accounts);
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
            if (remainingSupply < 0) {
                throw new Error(
                    `Mosaic ${m.name}'s fixed distributed supply ${providedSupply} is grater than mosaic total supply ${m.supply}`,
                );
            }
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
                    } but total is ${supplied}. \nDistributions are:\n${YamlUtils.toYaml(m.currencyDistributions)}`,
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

    public async resolveNodesAccounts(
        oldAddresses: Addresses | undefined,
        presetData: ConfigPreset,
        networkType: NetworkType,
    ): Promise<NodeAccount[]> {
        return Promise.all(
            (presetData.nodes || []).map((node, index) =>
                this.resolveNodeAccounts(oldAddresses?.nodes?.[index], presetData, index, node, networkType),
            ),
        );
    }

    public async resolveNodeAccounts(
        oldNodeAccount: NodeAccount | undefined,
        presetData: ConfigPreset,
        index: number,
        nodePreset: NodePreset,
        networkType: NetworkType,
    ): Promise<NodeAccount> {
        const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const name = nodePreset.name || `node-${index}`;
        const main = await this.resolveAccount(
            networkType,
            privateKeySecurityMode,
            KeyName.Main,
            nodePreset.name,
            oldNodeAccount?.main,
            ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.mainPublicKey, nodePreset.mainPrivateKey),
        );
        const transport = await this.resolveAccount(
            networkType,
            privateKeySecurityMode,
            KeyName.Transport,
            nodePreset.name,
            oldNodeAccount?.transport,
            ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.transportPublicKey, nodePreset.transportPrivateKey),
        );

        const friendlyName = nodePreset.friendlyName || main.publicKey.substr(0, 7);

        const nodeAccount: NodeAccount = {
            name,
            friendlyName,
            roles: ConfigurationUtils.resolveRoles(nodePreset),
            main: main,
            transport: transport,
        };

        const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;

        if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.remote = await this.resolveAccount(
                networkType,
                privateKeySecurityMode,
                KeyName.Remote,
                nodePreset.name,
                oldNodeAccount?.remote,
                ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.remotePublicKey, nodePreset.remotePrivateKey),
            );
        if (nodePreset.harvesting)
            nodeAccount.vrf = await this.resolveAccount(
                networkType,
                privateKeySecurityMode,
                KeyName.VRF,
                nodePreset.name,
                oldNodeAccount?.vrf,
                ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.vrfPublicKey, nodePreset.vrfPrivateKey),
            );

        return nodeAccount;
    }

    public generateAddresses(
        networkType: NetworkType,
        privateKeySecurityMode: PrivateKeySecurityMode,
        accounts: number | string[],
    ): ConfigAccount[] {
        if (typeof accounts == 'number') {
            return [...Array(accounts).keys()].map(() => ConfigurationUtils.toConfigAccount(Account.generateNewAccount(networkType)));
        } else {
            return accounts.map((key) => ConfigurationUtils.toConfigAccount(PublicAccount.createFromPublicKey(key, networkType)));
        }
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
    public async resolveAccount(
        networkType: NetworkType,
        privateKeySecurityMode: PrivateKeySecurityMode,
        keyName: KeyName,
        nodeName: string,
        oldStoredAccount: ConfigAccount | undefined,
        newProvidedAccount: ConfigAccount | undefined,
    ): Promise<ConfigAccount> {
        const oldAccount = ConfigurationUtils.toAccount(
            networkType,
            oldStoredAccount?.publicKey.toUpperCase(),
            oldStoredAccount?.privateKey?.toUpperCase(),
        );
        const newAccount = ConfigurationUtils.toAccount(
            networkType,
            newProvidedAccount?.publicKey?.toUpperCase(),
            newProvidedAccount?.privateKey?.toUpperCase(),
        );

        const getAccountLog = (a: Account | PublicAccount) => `${keyName} Account ${a.address.plain()} Public Key ${a.publicKey} `;

        if (oldAccount && newAccount) {
            if (oldAccount.address.equals(newAccount.address)) {
                this.logger.info(`Reusing ${getAccountLog(newAccount)}`);
                return { ...ConfigurationUtils.toConfigAccount(oldAccount), ...ConfigurationUtils.toConfigAccount(newAccount) };
            }
            this.logger.info(`Old ${getAccountLog(oldAccount)} has been changed. New ${getAccountLog(newAccount)} replaces it.`);
            return ConfigurationUtils.toConfigAccount(newAccount);
        }
        if (oldAccount) {
            this.logger.info(`Reusing ${getAccountLog(oldAccount)}...`);
            return ConfigurationUtils.toConfigAccount(oldAccount);
        }
        if (newAccount) {
            this.logger.info(`${getAccountLog(newAccount)} has been provided`);
            return ConfigurationUtils.toConfigAccount(newAccount);
        }

        const generateErrorMessage = this.resolveGenerateErrorMessage(keyName, privateKeySecurityMode);

        const account = await this.accountResolver.resolveAccount(
            networkType,
            newProvidedAccount || oldStoredAccount,
            keyName,
            nodeName,
            'initialization',
            generateErrorMessage,
        );
        return ConfigurationUtils.toConfigAccount(account);
    }
}
