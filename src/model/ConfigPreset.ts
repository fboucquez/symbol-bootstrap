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

import { NetworkType } from 'symbol-sdk';
import { Preset } from '../service';
import { NodeType } from './NodeType';

export interface DockerServicePreset {
    ipv4_address?: string;
    openPort?: boolean | number | string;
    host?: string;
    excludeDockerService?: boolean;
    environment?: any;
    compose?: any;
    dockerComposeDebugMode?: boolean;
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
    databaseName?: string;
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
    // If true, harvesterSigningPrivateKey != mainPrivateKey and harvesterSigningPrivateKey will be linked to mainPrivateKey
    serverVersion?: string;
    nodeUseRemoteAccount?: boolean;
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
    mainPrivateKey?: string;
    transportPrivateKey?: string;
    remotePrivateKey?: string;
    vrfPrivateKey?: string;
    votingPrivateKey?: string;

    //Broker specific
    brokerName?: string;
    brokerHost?: string;
    brokerIpv4_address?: string;
    brokerOpenPort?: boolean | number | string;
    brokerExcludeDockerService?: boolean;
    brokerCompose?: any;
    brokerDockerComposeDebugMode?: boolean;
    //super node
    supernode?: boolean | string;
    supernodeOpenPort?: boolean | number | string;
    agentUrl?: string; //calculated if not provided.
    restGatewayUrl?: string; // calculated if not provided;
}

export interface GatewayPreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    apiNodeName: string;
    apiNodeHost: string;
    databaseHost: string;
    name: string;
}

export interface ExplorerPreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    name: string;
}

export interface WalletProfilePreset {
    name: number;
    // if not provided, A file will be copied over from the working dir.
    data?: any;
    location?: string;
}

export interface WalletPreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    name: string;
    profiles?: WalletProfilePreset[];
}

export interface FaucetPreset extends DockerServicePreset {
    // At least these properties.
    gateway: string;
    repeat?: number;
    name: string;
}

export interface ConfigPreset {
    preset: Preset;
    votingKeysDirectory: string;
    agentBinaryLocation: string;
    serverVersion: string;
    epochAdjustment: string;
    catapultAppFolder: string;
    subnet?: string;
    transactionsDirectory: string;
    faucetUrl?: string;
    nemesis?: NemesisPreset;
    nemesisSeedFolder?: string; // Optional seed folder if user provides an external seed/00000 folder.
    assemblies?: string;
    databaseName: string;
    nemesisSignerPublicKey: string;
    nemesisGenerationHashSeed: string;
    harvestNetworkFeeSinkAddress?: string;
    mosaicRentalFeeSinkAddress?: string;
    namespaceRentalFeeSinkAddress?: string;
    nodeUseRemoteAccount: boolean;
    networkheight: boolean;
    dockerComposeVersion: number | string;
    dockerComposeServiceRestart: string;
    dockerComposeDebugMode: boolean;
    nodes?: NodePreset[];
    gateways?: GatewayPreset[];
    explorers?: ExplorerPreset[];
    wallets?: WalletPreset[];
    faucets?: FaucetPreset[];
    networkType: NetworkType;
    networkIdentifier: string;
    networkName: string;
    currencyMosaicId: string;
    harvestingMosaicId: string;
    baseNamespace: string;
    databases?: DatabasePreset[];
    knownPeers?: Record<NodeType, any[]>;
    knownRestGateways?: string[];
    mongoComposeRunParam: string;
    mongoImage: string;
    symbolServerToolsImage: string;
    symbolExplorerImage: string;
    symbolWalletImage: string;
    symbolFaucetImage: string;
    symbolServerImage: string;
    symbolRestImage: string;
    votingKeyStartEpoch: number;
    votingKeyEndEpoch: number;
    supernodeControllerPublicKey?: string;
    votingKeyLinkV2: number | undefined;
}
