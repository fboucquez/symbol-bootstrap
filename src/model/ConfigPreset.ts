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
    openPort: boolean;
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
    openBrokerPort: boolean;
    host?: string;
    name: string;
    type: NodeType;
    roles: string;
    friendlyName?: string;
    brokerHost?: string;
}

export interface GatewayPreset {
    // At least these properties.
    apiNodeHost: string;
    databaseHost: string;
    openPort?: boolean;
    name: string;
}

export interface ConfigPreset {
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
