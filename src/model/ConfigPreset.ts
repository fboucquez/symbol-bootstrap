import { NetworkType } from 'symbol-sdk';
import { NodeType } from './NodeType';

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
    repeat?: number;
    name: string;
    openPort?: boolean | number | string;
}

export interface NemesisPreset {
    binDirectory: string;
    mosaics?: MosaicPreset[];
    balances?: Record<string, number>;
    transactions?: Record<string, string>;
    nemesisSignerPrivateKey: string;
    transactionsDirectory: string;
}

export interface NodePreset {
    // At least these properties.
    repeat?: number;
    harvesting: boolean;
    api: boolean;
    voting: boolean;
    databaseHost: string;
    openBrokerPort?: boolean | number | string;
    openPort?: boolean | number | string;
    host?: string;
    name: string;
    roles: string;
    friendlyName?: string;
    brokerHost?: string;
    // Optional private keys. If not provided, bootstrap will generate random ones.
    signingPrivateKey?: string;
    vrfPrivateKey?: string;
    votingPrivateKey?: string;
}

export interface GatewayPreset {
    // At least these properties.
    repeat?: number;
    ipv4_address?: string;
    apiNodeName: string;
    apiNodeHost: string;
    databaseHost: string;
    openPort?: boolean | number | string;
    name: string;
}

export interface ConfigPreset {
    catapultAppFolder: string;
    subnet?: string;
    transactionsDirectory: string;
    faucetUrl?: string;
    nemesis?: NemesisPreset;
    nemesisSeedFolder?: string; // Optional seed folder if user provides an external seed/00000 folder.
    assemblies?: string;
    nemesisSignerPublicKey: string;
    nemesisGenerationHashSeed: string;
    nodes?: NodePreset[];
    gateways?: GatewayPreset[];
    networkType: NetworkType;
    networkIdentifier: string;
    networkName: string;
    currencyMosaicId: string;
    harvestingMosaicId: string;
    baseNamespace: string;
    databases?: DatabasePreset[];
    knownPeers?: Record<NodeType, any[]>;
    mongoImage: string;
    symbolServerToolsImage: string;
    symbolServerImage: string;
    symbolRestImage: string;
    votingKeyDilution: number;
    votingKeyStartEpoch: number;
    votingKeyEndEpoch: number;
}
