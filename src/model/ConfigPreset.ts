/*
 * Copyright 2022 Fernando Boucquez
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
import { DockerCompose, DockerComposeService } from './DockerCompose';

export enum PrivateKeySecurityMode {
    ENCRYPT = 'ENCRYPT',
    PROMPT_MAIN = 'PROMPT_MAIN',
    PROMPT_MAIN_TRANSPORT = 'PROMPT_MAIN_TRANSPORT',
    PROMPT_ALL = 'PROMPT_ALL',
}

export interface DockerServicePreset {
    ipv4_address?: string;
    openPort?: boolean | number | string;
    host?: string;
    excludeDockerService?: boolean;
    compose?: DockerComposeService;
    dockerComposeDebugMode?: boolean;
}

export interface CurrencyDistribution {
    address: string;
    amount: number;
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
    // options are generate x random accounts or provide their accounts public keys.
    accounts: number | string[];
    currencyDistributions: CurrencyDistribution[];
}

export interface DatabasePreset extends DockerServicePreset {
    repeat?: number;
    name: string;
    databaseName?: string;
}

export interface NemesisPreset {
    binDirectory: string;
    mosaics: MosaicPreset[];
    transactions?: Record<string, string>;
    nemesisSignerPrivateKey: string;
    transactionsDirectory: string;
}

export enum TransactionSelectionStrategy {
    maximizeFee = 'maximize-fee',
    oldest = 'oldest',
    minimizeFee = 'minimize-fee',
}
export enum DebugLevel {
    trace = 'Trace',
    debug = 'Debug',
    info = 'Info',
    important = 'Important',
    warning = 'Warning',
    error = 'Error',
    fatal = 'Fatal',
    min = 'Min',
    max = 'Max',
}

export enum SinkType {
    async = 'Async',
    sync = 'Sync',
}

export interface NodeConfigPreset {
    syncsource: boolean;
    filespooling: boolean;
    partialtransaction: boolean;
    sinkType: SinkType;
    enableSingleThreadPool: boolean;
    addressextraction: boolean;
    mongo: boolean;
    zeromq: boolean;
    enableAutoSyncCleanup: boolean;
    serverVersion: string;
    nodeUseRemoteAccount: boolean;
    beneficiaryAddress?: string;
    stepDuration: string;
    logLevel: DebugLevel;
    shortLivedCacheMessageDuration: string;
    readRateMonitoringBucketDuration: string;
    networkHeightMaxNodes: number;
    mongoImage: string;
    harvestBeneficiaryPercentage: number;
    totalChainImportance: number;
    maxSubcompactionThreads: number;
    partialTransactionsCacheMaxSize: string;
    votingSetGrouping: number;
    trustedHosts: string;
    shortLivedCacheTransactionDuration: string;
    transactionDisruptorSlotCount: number;
    outgoing_connections_maxConnectionAge: number;
    maxMosaicAtomicUnits: number;
    binDirectory: string;
    timeSynchronizationMinImportance: number;
    nodePort: number;
    maxBackgroundThreads: number;
    maxMultisigDepth: number;
    maxChildNamespaces: number;
    maxTrackedNodes: string;
    transactionSelectionStrategy: TransactionSelectionStrategy;
    blockDisruptorSlotCount: number;
    minTransactionFailuresPercentForBan: number;
    enableCacheDatabaseStorage: boolean;
    maxTransactionLifetime: string;
    maxVotingKeyLifetime: number;
    maxMosaicDivisibility: number;
    blockCacheSize: string;
    maxNameSize: number;
    enableStatistics: boolean;
    batchVerificationRandomSource: null;
    maxMosaicsPerAccount: number;
    maxBannedNodes: number;
    maxBlockFutureTime: string;
    maxBondedTransactionLifetime: string;
    subscriberPort: number;
    maxUnlockedAccounts: number;
    maxHashesPerPoint: number;
    delegatePrioritizationPolicy: string;
    minFeeMultiplier: number;
    minVoterBalance: number;
    maxCosignedAccountsPerAccount: number;
    socketWorkingBufferSize: string;
    rootNamespaceRentalFeePerBlock: number;
    transactionSpamThrottlingMaxBoostFee: number;
    enableTransactionSpamThrottling: boolean;
    defaultBanDuration: string;
    mosaicRentalFee: number;
    enableAutoHarvesting: boolean;
    outgoing_connections_numConsecutiveFailuresBeforeBanning: number;
    importanceActivityPercentage: number;
    maxWriteBatchSize: string;
    shortLivedCachePruneInterval: string;
    messagingListenInterface: string;
    lockedFundsPerAggregate: number;
    enableVerifiableState: boolean;
    maxDifficultyBlocks: number;
    maxNamespaceDuration: string;
    shortLivedCacheBlockDuration: string;
    maxValueSize: number;
    minHarvesterBalance: number;
    incoming_connections_numConsecutiveFailuresBeforeBanning: number;
    childNamespaceRentalFee: number;
    maxHarvesterBalance: number;
    syncTimeout: string;
    maxIncomingConnectionsPerIdentity: number;
    maxHashesPerSyncAttempt: number;
    maxSecretLockDuration: string;
    maxReadRateMonitoringTotalSize: string;
    connectTimeout: string;
    minProofSize: number;
    finalizationSize: number;
    maxAccountRestrictionValues: number;
    enableStrictCosignatureCheck: boolean;
    maxDropBatchSize: number;
    namespaceGracePeriodDuration: string;
    blockTimeSmoothingFactor: number;
    incoming_connections_maxConnectionBanAge: number;
    maxCosignaturesPerAggregate: number;
    enableDispatcherInputAuditing: boolean;
    incoming_connections_maxConnectionAge: number;
    maxNamespaceDepth: number;
    shortLivedCacheMaxSize: number;
    enableBondedAggregateSupport: boolean;
    numReadRateMonitoringBuckets: number;
    enableVerifiableReceipts: boolean;
    reservedRootNamespaceNames: string;
    defaultDynamicFeeMultiplier: number;
    enableDispatcherAbortWhenFull: boolean;
    maxOpenFiles: number;
    unconfirmedTransactionsCacheMaxResponseSize: string;
    blockElementTraceInterval: number;
    maxChainBytesPerSyncAttempt: string;
    writeTimeout: string;
    unconfirmedTransactionsCacheMaxSize: string;
    nodeEqualityStrategy: string;
    harvestNetworkPercentage: number;
    importanceGrouping: number;
    maxRollbackBlocks: number;
    nodeListenInterface: string;
    minTransactionFailuresCountForBan: number;
    initialCurrencyAtomicUnits: number;
    prevoteBlocksMultiple: number;
    socketWorkingBufferSensitivity: number;
    blockDisruptorMaxMemorySize: string;
    incoming_connections_backlogSize: number;
    keepAliveDuration: string;
    maxPacketDataSize: string;
    outgoing_connections_maxConnectionBanAge: number;
    maxMosaicDuration: string;
    enableAddressReuse: boolean;
    timeSynchronizationMaxNodes: number;
    outgoing_connections_maxConnections: number;
    fileDatabaseBatchSize: number;
    maxCosignatoriesPerAccount: number;
    blockGenerationTargetTime: string;
    transactionElementTraceInterval: number;
    minPartnerNodeVersion: string;
    maxHashLockDuration: string;
    transactionDisruptorMaxMemorySize: string;
    memtableMemoryBudget: string;
    networkheight: boolean;
    finalizationThreshold: number;
    minNamespaceDuration: string;
    maxVotingKeysPerAccount: number;
    messageSynchronizationMaxResponseSize: string;
    maxTimeBehindPullTransactionsStart: string;
    maxBlocksPerSyncAttempt: number;
    databaseName: string;
    enableDelegatedHarvestersAutoDetection: boolean;
    incoming_connections_maxConnections: number;
    certificateDirectory: string;
    maxMosaicRestrictionValues: number;
    minVotingKeyLifetime: number;
    enableRevoteOnBoot: boolean;
    partialTransactionsCacheMaxResponseSize: string;
    seedDirectory: string;
    maxBanDuration: string;
    maxPartnerNodeVersion: string;
    maxWriterThreads: number;
    maxMessageSize: number;
    maxTransactionsPerAggregate: number;
    maxProofSize: number;
    maxTransactionsPerBlock: number;
    localNetworks: string;
    caCertificateExpirationInDays: number;
    nodeCertificateExpirationInDays: number;
    certificateExpirationWarningInDays: number;
}

export interface NodePreset extends DockerServicePreset, Partial<NodeConfigPreset> {
    name: string;
    harvesting: boolean;
    api: boolean;
    voting: boolean;

    repeat?: number;
    databaseHost?: string;
    host?: string;
    roles?: string;
    friendlyName?: string;
    excludeFromNemesis: boolean;

    // Optional private keys. If not provided, bootstrap will generate random ones.
    mainPrivateKey?: string;
    mainPublicKey?: string;

    transportPrivateKey?: string;
    transportPublicKey?: string;

    remotePrivateKey?: string;
    remotePublicKey?: string;

    vrfPrivateKey?: string;
    vrfPublicKey?: string;

    balances?: number[];

    //Broker specific
    brokerName?: string;
    brokerHost?: string;
    brokerIpv4_address?: string;
    brokerOpenPort?: boolean | number | string;
    brokerExcludeDockerService?: boolean;
    brokerCompose?: any;
    brokerDockerComposeDebugMode?: boolean;
}

export interface GatewayConfigPreset {
    throttlingBurst: number;
    connectionPoolSize: number;
    apiNodeBrokerPort: number;
    apiNodeConfigPath: string;
    apiNodeBrokerPortMonitorInterval: number;
    maxConnectionAttempts: number;
    apiNodeBrokerConnectTimeout: number;
    restLoggingFilename: string;
    apiNodeBrokerMonitorLoggingThrottle: number;
    apiNodePort: number;
    throttlingRate: number;
    maxSubscriptions: number;
    apiNodeTimeout: number;
    baseRetryDelay: number;
    restDeploymentTool: string;
    restDeploymentToolVersion?: string; // default is dynamic, current bootstrap version
    restDeploymentToolLastUpdatedDate?: string; // default is dynamic, current datetime
    restProtocol: 'HTTPS' | 'HTTP';
    restExtensions: string;
    restUncirculatingAccountPublicKeys: string;
    restSSLPath: string;
    restSSLKeyFileName: string;
    restSSLCertificateFileName: string;
    restSSLKeyBase64?: string;
    restSSLCertificateBase64?: string;
}

export interface GatewayPreset extends DockerServicePreset, Partial<GatewayConfigPreset> {
    // At least these properties.
    repeat?: number;
    apiNodeName: string;
    apiNodeHost: string;
    databaseHost: string;
    name: string;
}

export interface HttpsProxyPreset extends DockerServicePreset {
    name?: string;
    domains: string;
    stage: string;
    webSocket?: string;
    serverNamesHashBucketSize?: number;
}

export interface ExplorerPreset extends DockerServicePreset {
    // At least these properties.
    repeat?: number;
    name: string;
}

export interface FaucetPreset extends DockerServicePreset {
    // At least these properties.
    gateway: string;
    repeat?: number;
    name: string;
}

export interface PeerInfo {
    publicKey: string;
    endpoint: {
        host: string;
        port: number;
    };
    metadata: {
        name: string;
        roles: string;
    };
}
export type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
};

export interface CommonConfigPreset extends NodeConfigPreset, GatewayConfigPreset {
    version: number; // file version
    reportBootstrapVersion: string;
    preset: string;
    assembly: string;
    privateKeySecurityMode?: string;
    votingKeysDirectory: string;
    sinkAddress?: string;
    epochAdjustment: string;
    catapultAppFolder: string;
    dataDirectory: string;
    subnet?: string;
    transactionsDirectory: string;
    faucetUrl?: string;
    nemesisSeedFolder?: string; // Optional seed folder if user provides an external seed/00000 folder.
    domain?: string; // Optional for services assembly.

    symbolServerImage: string;
    symbolExplorerImage: string;
    symbolRestImage: string;
    symbolFaucetImage: string;
    httpsPortalImage: string;

    dockerComposeVersion: number | string;
    dockerComposeServiceRestart: string;
    dockerComposeDebugMode: boolean;
    mongoComposeRunParam: string;
    peersP2PListLimit: number;
    peersApiListLimit: number;

    nonVotingUnfinalizedBlocksDuration: string;
    votingUnfinalizedBlocksDuration?: string;
    nemesisSignerPublicKey: string;
    nemesisGenerationHashSeed: string;
    harvestNetworkFeeSinkAddressV1?: string;
    harvestNetworkFeeSinkAddress?: string;
    mosaicRentalFeeSinkAddressV1?: string;
    mosaicRentalFeeSinkAddress?: string;
    namespaceRentalFeeSinkAddressV1?: string;
    namespaceRentalFeeSinkAddress?: string;
    networkIdentifier: string;
    networkName: string;
    networkDescription: string;
    currencyMosaicId: string;
    harvestingMosaicId: string;
    baseNamespace: string;
    networkType: NetworkType;
    votingKeyDesiredLifetime: number;
    votingKeyDesiredFutureLifetime: number; // How in the future voting key files need to be generated. By default, 1 months before expiring..
    useExperimentalNativeVotingKeyGeneration?: boolean;
    lastKnownNetworkEpoch: number;
    autoUpdateVotingKeys: boolean;
    statisticsServiceUrl?: string;
    statisticsServicePeerLimit: number;
    statisticsServicePeerFilter?: string;
    statisticsServiceRestLimit: number;
    statisticsServiceRestFilter?: string;

    // Nested Objects
    inflation?: Record<string, number>;
    // Allows hardcoded list. For new networks and for possible fallbacks.
    knownRestGateways?: string[];
    knownPeers?: PeerInfo[];
    // Allows users to provide their own modification to the generate compose.yml, for example, a new docker service.
    compose: DeepPartial<DockerCompose>;
}

export interface ConfigPreset extends CommonConfigPreset {
    // Nested objects!
    nemesis: NemesisPreset;
    databases?: DatabasePreset[];
    nodes?: NodePreset[];
    gateways?: GatewayPreset[];
    explorers?: ExplorerPreset[];
    faucets?: FaucetPreset[];
    httpsProxies?: HttpsProxyPreset[];
    customPresetCache?: CustomPreset;
}

export interface CustomPreset extends Partial<CommonConfigPreset> {
    nemesis?: DeepPartial<NemesisPreset>;
    databases?: DeepPartial<DatabasePreset>[];
    nodes?: DeepPartial<NodePreset>[];
    gateways?: DeepPartial<GatewayPreset>[];
    explorers?: DeepPartial<ExplorerPreset>[];
    faucets?: DeepPartial<FaucetPreset>[];
    httpsProxies?: DeepPartial<HttpsProxyPreset>[];
}
