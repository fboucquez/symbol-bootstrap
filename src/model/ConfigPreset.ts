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
    name: string;
    openPort?: boolean | number;
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
    databaseHost: string;
    openBrokerPort?: boolean | number;
    openPort?: boolean | number;
    name: string;
    type: NodeType;
    roles: string;
    friendlyName?: string;
    brokerHost?: string;
}

export interface GatewayPreset {
    // At least these properties.
    ipv4_address?: string;
    apiNodeName: string;
    apiNodeHost: string;
    databaseHost: string;
    openPort?: boolean | number;
    name: string;
}

export interface ConfigPreset {
    subnet?: string;
    transactionsDirectory: string;
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
}
