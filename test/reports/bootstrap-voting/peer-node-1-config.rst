
config-database.properties
==========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **database**;
    databaseUri; mongodb://:27017
    databaseName; catapult
    maxWriterThreads; 8
    **plugins**;
    catapult.mongo.plugins.accountlink; true
    catapult.mongo.plugins.aggregate; true
    catapult.mongo.plugins.lockhash; true
    catapult.mongo.plugins.locksecret; true
    catapult.mongo.plugins.metadata; true
    catapult.mongo.plugins.mosaic; true
    catapult.mongo.plugins.multisig; true
    catapult.mongo.plugins.namespace; true
    catapult.mongo.plugins.restrictionaccount; true
    catapult.mongo.plugins.restrictionmosaic; true
    catapult.mongo.plugins.transfer; true

config-extensions-broker.properties
===================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.addressextraction; true
    extension.mongo; true
    extension.zeromq; true
    extension.hashcache; true

config-extensions-recovery.properties
=====================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.addressextraction; false
    extension.mongo; false
    extension.zeromq; false
    extension.hashcache; true

config-extensions-server.properties
===================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.filespooling; false
    extension.partialtransaction; false
    extension.addressextraction; false
    extension.mongo; false
    extension.zeromq; false
    extension.eventsource; false
    extension.harvesting; true
    extension.syncsource; true
    extension.diagnostics; true
    extension.finalization; true
    extension.hashcache; true
    extension.networkheight; false
    extension.nodediscovery; true
    extension.packetserver; true
    extension.pluginhandlers; true
    extension.sync; true
    extension.timesync; true
    extension.transactionsink; true
    extension.unbondedpruning; true

config-finalization.properties
==============================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **finalization**;
    enableVoting; true
    size; 10'000
    threshold; 7'000
    stepDuration; 4m
    shortLivedCacheMessageDuration; 10m
    messageSynchronizationMaxResponseSize; 20MB
    maxHashesPerPoint; 256
    prevoteBlocksMultiple; 4
    votingKeyDilution; 128

config-harvesting.properties
============================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **harvesting**; ; ;
    harvesterSigningPrivateKey; ****************************************************************; string; Harvester signing private key.
    harvesterVrfPrivateKey; ****************************************************************; string; Harvester vrf private key.
    enableAutoHarvesting; true; bool; Set to true if auto harvesting is enabled.
    maxUnlockedAccounts; 5; uint32_t; Maximum number of unlocked accounts.
    delegatePrioritizationPolicy; Importance; harvesting::DelegatePrioritizationPolicy; Delegate harvester prioritization policy.
    beneficiaryAddress; ; Address; Address of the account receiving part of the harvested fee.

config-inflation.properties
===========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **inflation**;
    starting-at-height-1; 0
    starting-at-height-10000; 0

config-logging-broker.properties
================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Async
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Async
    level; Info
    directory; logs
    filePattern; logs/catapult_broker%4N.log
    rotationSize; 25MB
    maxTotalSize; 2500MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-logging-recovery.properties
==================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Sync
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Async
    level; Info
    directory; logs
    filePattern; logs/catapult_recovery%4N.log
    rotationSize; 25MB
    maxTotalSize; 2500MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-logging-server.properties
================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Sync
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Sync
    level; Info
    directory; logs
    filePattern; logs/catapult_server%4N.log
    rotationSize; 25MB
    maxTotalSize; 2500MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-messaging.properties
===========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **messaging**;
    subscriberPort; 7902

config-network.properties
=========================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **network**; ; ;
    identifier; public-test; NetworkIdentifier; Network identifier.
    nemesisSignerPublicKey; DA007A7CCA877805DF0DD6250C9806E7B25DC3ED21E506569239D11A7175101A; Key; Nemesis public key.
    nodeEqualityStrategy; host; NodeIdentityEqualityStrategy; Node equality strategy.
    generationHashSeed; 6AF8E35BBC7AC341E7931B39E2C9A591EDBE9F9111996053E6771D48E9C53B31; ;
    epochAdjustment; 1573430400s; utils::TimeSpan; Nemesis epoch time adjustment.
    **chain**; ; ;
    enableVerifiableState; true; bool; Set to true if block chain should calculate state hashes so that state is fully verifiable at each block.
    enableVerifiableReceipts; true; bool; Set to true if block chain should calculate receipts so that state changes are fully verifiable at each block.
    currencyMosaicId; 0x3A39'4A5A'4739'A3D0; MosaicId; Mosaic id used as primary chain currency.
    harvestingMosaicId; 0x5D21'03FE'AFEF'E767; MosaicId; Mosaic id used to provide harvesting ability.
    blockGenerationTargetTime; 15s; utils::TimeSpan; Targeted time between blocks.
    blockTimeSmoothingFactor; 3000; uint32_t; Note: A higher value makes the network more biased. Note: This can lower security because it will increase the influence of time relative to importance.
    importanceGrouping; 180; uint64_t; Number of blocks that should be treated as a group for importance purposes. Note: Importances will only be calculated at blocks that are multiples of this grouping number.
    importanceActivityPercentage; 5; uint8_t; Percentage of importance resulting from fee generation and beneficiary usage.
    maxRollbackBlocks; 0; uint32_t; Maximum number of blocks that can be rolled back.
    maxDifficultyBlocks; 60; uint32_t; Maximum number of blocks to use in a difficulty calculation.
    defaultDynamicFeeMultiplier; 1'000; BlockFeeMultiplier; Default multiplier to use for dynamic fees.
    maxTransactionLifetime; 6h; utils::TimeSpan; Maximum lifetime a transaction can have before it expires.
    maxBlockFutureTime; 500ms; utils::TimeSpan; Maximum future time of a block that can be accepted.
    initialCurrencyAtomicUnits; 8'998'999'998'000'000; Amount; Initial currency atomic units available in the network.
    maxMosaicAtomicUnits; 9'000'000'000'000'000; Amount; Maximum atomic units (total-supply * 10 ^ divisibility) of a mosaic allowed in the network.
    totalChainImportance; 15'000'000; Importance; Total whole importance units available in the network.
    minHarvesterBalance; 500; Amount; Minimum number of harvesting mosaic atomic units needed for an account to be eligible for harvesting.
    maxHarvesterBalance; 50'000'000'000'000; Amount; Maximum number of harvesting mosaic atomic units needed for an account to be eligible for harvesting.
    minVoterBalance; 50'000; Amount; Minimum number of harvesting mosaic atomic units needed for an account to be eligible for voting.
    votingSetGrouping; 100; ;
    maxVotingKeysPerAccount; 3; uint8_t; Maximum number of voting keys that can be registered at once per account.
    minVotingKeyLifetime; 28; uint32_t; Minimum number of finalization rounds for which voting key can be registered.
    maxVotingKeyLifetime; 26280; uint32_t; Maximum number of finalization rounds for which voting key can be registered.
    harvestBeneficiaryPercentage; 10; uint8_t; Percentage of the harvested fee that is collected by the beneficiary account.
    harvestNetworkPercentage; 5; uint8_t; Percentage of the harvested fee that is collected by the network.
    harvestNetworkFeeSinkAddress; TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q; Address; Address of the harvest network fee sink account.
    maxTransactionsPerBlock; 6'000; uint32_t; Maximum number of transactions per block.
    **plugin:catapult.plugins.accountlink**;
    dummy; to trigger plugin load
    **plugin:catapult.plugins.aggregate**; ; ;
    maxTransactionsPerAggregate; 100; uint32_t; Maximum number of transactions per aggregate.
    maxCosignaturesPerAggregate; 25; uint8_t; Maximum number of cosignatures per aggregate.
    enableStrictCosignatureCheck; false; bool; Set to true if cosignatures must exactly match component signers. Set to false if cosignatures should be validated externally.
    enableBondedAggregateSupport; true; bool; Set to true if bonded aggregates should be allowed. Set to false if bonded aggregates should be rejected.
    maxBondedTransactionLifetime; 48h; utils::TimeSpan; Maximum lifetime a bonded transaction can have before it expires.
    **plugin:catapult.plugins.lockhash**; ; ;
    lockedFundsPerAggregate; 10'000'000; Amount; Amount that has to be locked per aggregate in partial cache.
    maxHashLockDuration; 2d; utils::BlockSpan; Maximum number of blocks for which a hash lock can exist.
    **plugin:catapult.plugins.locksecret**; ; ;
    maxSecretLockDuration; 30d; utils::BlockSpan; Maximum number of blocks for which a secret lock can exist.
    minProofSize; 20; uint16_t; Minimum size of a proof in bytes.
    maxProofSize; 1024; uint16_t; Maximum size of a proof in bytes.
    **plugin:catapult.plugins.metadata**; ; ;
    maxValueSize; 1024; uint16_t; Maximum metadata value size.
    **plugin:catapult.plugins.mosaic**; ; ;
    maxMosaicsPerAccount; 1'000; uint16_t; Maximum number of mosaics that an account can own.
    maxMosaicDuration; 3650d; utils::BlockSpan; Maximum mosaic duration.
    maxMosaicDivisibility; 6; uint8_t; Maximum mosaic divisibility.
    mosaicRentalFeeSinkAddress; TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q; Address; Address of the mosaic rental fee sink account.
    mosaicRentalFee; 500; Amount; Mosaic rental fee.
    **plugin:catapult.plugins.multisig**; ; ;
    maxMultisigDepth; 3; uint8_t; Maximum number of multisig levels.
    maxCosignatoriesPerAccount; 25; uint32_t; Maximum number of cosignatories per account.
    maxCosignedAccountsPerAccount; 25; uint32_t; Maximum number of accounts a single account can cosign.
    **plugin:catapult.plugins.namespace**; ; ;
    maxNameSize; 64; uint8_t; Maximum namespace name size.
    maxChildNamespaces; 256; uint16_t; Maximum number of children for a root namespace.
    maxNamespaceDepth; 3; uint8_t; Maximum namespace depth.
    minNamespaceDuration; 1m; utils::BlockSpan; Minimum namespace duration.
    maxNamespaceDuration; 365d; utils::BlockSpan; Maximum namespace duration.
    namespaceGracePeriodDuration; 30d; utils::BlockSpan; Grace period during which time only the previous owner can renew an expired namespace.
    reservedRootNamespaceNames; symbol, symbl, xym, xem, nem, user, account, org, com, biz, net, edu, mil, gov, info; unordered_set<string>; Reserved root namespaces that cannot be claimed.
    namespaceRentalFeeSinkAddress; TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q; Address; Address of the namespace rental fee sink account.
    rootNamespaceRentalFeePerBlock; 1; Amount; Root namespace rental fee per block.
    childNamespaceRentalFee; 100; Amount; Child namespace rental fee.
    **plugin:catapult.plugins.restrictionaccount**; ; ;
    maxAccountRestrictionValues; 512; uint16_t; Maximum number of account restriction values.
    **plugin:catapult.plugins.restrictionmosaic**; ; ;
    maxMosaicRestrictionValues; 20; uint8_t; Maximum number of mosaic restriction values.
    **plugin:catapult.plugins.transfer**; ; ;
    maxMessageSize; 1024; uint16_t; Maximum transaction message size.

config-networkheight.properties
===============================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **networkheight**;
    maxNodes; 5

config-node.properties
======================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **node**; ; ;
    port; 7900; unsigned short; Server port.
    maxIncomingConnectionsPerIdentity; 6; uint32_t; Maximum number of incoming connections per identity over primary port.
    enableAddressReuse; false; bool; Set to true if the server should reuse ports already in use.
    enableSingleThreadPool; true; bool; Set to true if a single thread pool should be used, Set to false if multiple thread pools should be used.
    enableCacheDatabaseStorage; true; bool; Set to true if cache data should be saved in a database.
    enableAutoSyncCleanup; true; bool; Set to true if temporary sync files should be automatically cleaned up. Note: This should be Set to false if broker process is running.
    enableTransactionSpamThrottling; true; bool; Set to true if transaction spam throttling should be enabled.
    transactionSpamThrottlingMaxBoostFee; 10'000'000; Amount; Maximum fee that will boost a transaction through the spam throttle when spam throttling is enabled.
    maxHashesPerSyncAttempt; 610; ;
    maxBlocksPerSyncAttempt; 602; uint32_t; Maximum number of blocks per sync attempt.
    maxChainBytesPerSyncAttempt; 100MB; utils::FileSize; Maximum chain bytes per sync attempt.
    shortLivedCacheTransactionDuration; 10m; utils::TimeSpan; Duration of a transaction in the short lived cache.
    shortLivedCacheBlockDuration; 100m; utils::TimeSpan; Duration of a block in the short lived cache.
    shortLivedCachePruneInterval; 90s; utils::TimeSpan; Time between short lived cache pruning.
    shortLivedCacheMaxSize; 200'000; uint32_t; Maximum size of a short lived cache.
    minFeeMultiplier; 100; BlockFeeMultiplier; Minimum fee multiplier of transactions to propagate and include in blocks.
    transactionSelectionStrategy; maximize-fee; model::TransactionSelectionStrategy; Transaction selection strategy used for syncing and harvesting unconfirmed transactions.
    unconfirmedTransactionsCacheMaxResponseSize; 20MB; utils::FileSize; Maximum size of an unconfirmed transactions response.
    unconfirmedTransactionsCacheMaxSize; 50'000; uint32_t; Maximum size of the unconfirmed transactions cache.
    connectTimeout; 15s; utils::TimeSpan; Timeout for connecting to a peer.
    syncTimeout; 120s; utils::TimeSpan; Timeout for syncing with a peer.
    socketWorkingBufferSize; 512KB; utils::FileSize; Initial socket working buffer size (socket reads will attempt to read buffers of roughly this size).
    socketWorkingBufferSensitivity; 100; uint32_t; Socket working buffer sensitivity (lower values will cause memory to be more aggressively reclaimed). Note: Set to 0 will disable memory reclamation.
    maxPacketDataSize; 150MB; utils::FileSize; Maximum packet data size.
    blockDisruptorSize; 4096; uint32_t; Size of the block disruptor circular buffer.
    blockElementTraceInterval; 1; uint32_t; Multiple of elements at which a block element should be traced through queue and completion.
    transactionDisruptorSize; 16384; uint32_t; Size of the transaction disruptor circular buffer.
    transactionElementTraceInterval; 10; uint32_t; Multiple of elements at which a transaction element should be traced through queue and completion.
    enableDispatcherAbortWhenFull; false; bool; Set to true if the process should terminate when any dispatcher is full.
    enableDispatcherInputAuditing; false; bool; Set to true if all dispatcher inputs should be audited.
    maxCacheDatabaseWriteBatchSize; 5MB; utils::FileSize; Maximum cache database write batch size.
    maxTrackedNodes; 5'000; uint32_t; Maximum number of nodes to track in memory.
    trustedHosts; 127.0.0.1; unordered_set<string>; Trusted hosts that are allowed to execute protected API calls on this node.
    localNetworks; 127.0.0.1; unordered_set<string>; Networks that should be treated as local.
    **localnode**; ; ;
    host; peer-node-1; string; Node host (leave empty to auto-detect IP).
    friendlyName; my-peer-node-1; string; Node friendly name (leave empty to use address).
    version; 0; uint32_t; Node version.
    roles; Peer,Voting; ionet::NodeRoles; Node roles.
    **outgoing_connections**; ; ;
    maxConnections; 10; uint16_t; Maximum number of active connections.
    maxConnectionAge; 200; uint16_t; Maximum connection age.
    maxConnectionBanAge; 20; uint16_t; Maximum connection ban age.
    numConsecutiveFailuresBeforeBanning; 3; uint16_t; Number of consecutive connection failures before a connection is banned.
    **incoming_connections**; ; ;
    maxConnections; 512; uint16_t; Maximum number of active connections.
    maxConnectionAge; 200; uint16_t; Maximum connection age.
    maxConnectionBanAge; 20; uint16_t; Maximum connection ban age.
    numConsecutiveFailuresBeforeBanning; 3; uint16_t; Number of consecutive connection failures before a connection is banned.
    backlogSize; 512; uint16_t; Maximum size of the pending connections queue.
    **banning**; ; ;
    defaultBanDuration; 12h; utils::TimeSpan; Default duration for banning.
    maxBanDuration; 12h; utils::TimeSpan; Maximum duration for banning.
    keepAliveDuration; 48h; utils::TimeSpan; Duration to keep account in container after the ban expired.
    maxBannedNodes; 5'000; uint32_t; Maximum number of banned nodes.
    numReadRateMonitoringBuckets; 4; uint16_t; Number of read rate monitoring buckets (Set to 0 to disable read rate monitoring).
    readRateMonitoringBucketDuration; 15s; utils::TimeSpan; Duration of each read rate monitoring bucket.
    maxReadRateMonitoringTotalSize; 100MB; utils::FileSize; Maximum size allowed during full read rate monitoring period.

config-pt.properties
====================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **partialtransactions**;
    cacheMaxResponseSize; 20MB
    cacheMaxSize; 1'000'000

config-task.properties
======================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **logging task**;
    startDelay; 1m
    repeatDelay; 10m
    **connect peers task for service Finalization**;
    startDelay; 2s
    repeatDelay; 1m
    **finalization task**;
    startDelay; 2m
    repeatDelay; 15s
    **pull finalization messages task**;
    startDelay; 3s
    repeatDelay; 1s
    **pull finalization proof task**;
    startDelay; 10s
    repeatDelay; 50s
    **harvesting task**;
    startDelay; 30s
    repeatDelay; 1s
    **network chain height detection**;
    startDelay; 1s
    repeatDelay; 15s
    **node discovery peers task**;
    startDelay; 1m
    minDelay; 1m
    maxDelay; 10m
    numPhaseOneRounds; 10
    numTransitionRounds; 20
    **node discovery ping task**;
    startDelay; 2m
    repeatDelay; 5m
    **age peers task for service Readers**;
    startDelay; 1m
    repeatDelay; 1m
    **batch partial transaction task**;
    startDelay; 500ms
    repeatDelay; 500ms
    **connect peers task for service Pt**;
    startDelay; 3s
    repeatDelay; 1m
    **pull partial transactions task**;
    startDelay; 10s
    repeatDelay; 3s
    **batch transaction task**;
    startDelay; 500ms
    repeatDelay; 500ms
    **connect peers task for service Sync**;
    startDelay; 1s
    repeatDelay; 1m
    **pull unconfirmed transactions task**;
    startDelay; 4s
    repeatDelay; 3s
    **synchronizer task**;
    startDelay; 3s
    repeatDelay; 3s
    **time synchronization task**;
    startDelay; 1m
    minDelay; 3m
    maxDelay; 180m
    numPhaseOneRounds; 5
    numTransitionRounds; 10
    **static node refresh task**;
    startDelay; 5ms
    minDelay; 15s
    maxDelay; 24h
    numPhaseOneRounds; 20
    numTransitionRounds; 20

config-timesync.properties
==========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **timesynchronization**;
    maxNodes; 20
    minImportance; 3'750

config-user.properties
======================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **account**;
    enableDelegatedHarvestersAutoDetection; true
    **storage**;
    certificateDirectory; ./userconfig/resources/cert
    dataDirectory; ./data
    pluginsDirectory; /usr/catapult/lib
    votingKeysDirectory; ./data/votingkeys