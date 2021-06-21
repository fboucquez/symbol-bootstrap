var networkTypeConfig = {
  "explorerUrl": "",
  "faucetUrl": "http://localhost:100",
  "defaultNetworkType": 120,
  "defaultNodeUrl": "http://nemesis-private-node:3000",
  "networkConfigurationDefaults": {
    "maxMosaicDivisibility": 6,
    "namespaceGracePeriodDuration": 2592000,
    "lockedFundsPerAggregate": "10000000",
    "maxCosignatoriesPerAccount": 25,
    "blockGenerationTargetTime": 30,
    "maxNamespaceDepth": 3,
    "maxMosaicDuration": 315360000,
    "minNamespaceDuration": 2592000,
    "maxNamespaceDuration": 157680000,
    "maxTransactionsPerAggregate": 100,
    "maxCosignedAccountsPerAccount": 25,
    "maxMessageSize": 1024,
    "maxMosaicAtomicUnits":  8999999999000000,
    "currencyMosaicId": "4DAEC93E2FAD68E2",
    "harvestingMosaicId": "4DAEC93E2FAD68E2",
    "defaultDynamicFeeMultiplier": 100,
    "epochAdjustment": 1626575785,
    "totalChainImportance": 7842928625000000,
    "generationHash": "000000000000000000000000000000000000000000000000000000000000000A"
  },
  "nodes": [
    {"friendlyName": "nemesis-private-node", "roles": 2, "url": "http://nemesis-private-node:3000"},
    {"friendlyName": "testprefix-dual-001.mytest.com", "roles": 2, "url": "http://testprefix-dual-001.mytest.com:3000"},
    {"friendlyName": "testprefix-dual-002.mytest.com", "roles": 2, "url": "http://testprefix-dual-002.mytest.com:3000"},
    {"friendlyName": "testprefix-demo-001.mytest.com", "roles": 2, "url": "http://testprefix-demo-001.mytest.com:3000"},
  ]
}
var networkConfig = { 120 : networkTypeConfig }
window.networkConfig = networkConfig
console.log('networkConfig loaded!', networkConfig)




