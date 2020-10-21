import { NetworkType } from 'symbol-sdk';
import { NodeType } from './NodeType';

export interface DockerServicePreset {
    ipv4_address?: string;
    openPort?: boolean | number | string;
    host?: string;
    excludeDockerService?: boolean;
    environment?: any;
}

export interface MosaicPreset {
    name: string;
    repeat?: number;
    main: boolean;
    harvest: boolean;
    divisibility: number;
    duration: number;
    supply: number;
    isTransferable: boolean;
    isSupplyMutable: boolean;
    isRestrictable: boolean;
    accounts: number;
    currencyDistributions: { address: string; amount: number }[];
}

export interface DatabasePreset extends DockerServicePreset {
    repeat?: number;
    name: string;
}

export interface NemesisPreset {
    binDirectory: string;
    mosaics?: MosaicPreset[];
    balances?: Record<string, number>;
    transactions?: Record<string, string>;
    nemesisSignerPrivateKey: string;
    transactionsDirectory: string;
}

export interface NodePreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    harvesting: boolean;
    api: boolean;
    voting: boolean;
    databaseHost: string;
    host?: string;
    name: string;
    roles: string;
    friendlyName?: string;
    // Optional private keys. If not provided, bootstrap will generate random ones.
    signingPrivateKey?: string;
    vrfPrivateKey?: string;
    votingPrivateKey?: string;

    //Broker specific
    brokerName?: string;
    brokerHost?: string;
    brokerIpv4_address?: string;
    brokerOpenPort?: boolean | number | string;
    brokerExcludeDockerService?: boolean;
}

export interface GatewayPreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    apiNodeName: string;
    apiNodeHost: string;
    databaseHost: string;
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
    harvestNetworkFeeSinkAddress?: string;
    mosaicRentalFeeSinkAddress?: string;
    namespaceRentalFeeSinkAddress?: string;
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
