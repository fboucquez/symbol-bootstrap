# Custom presets

It's the way you can tune the network without modifying the code. It's a yml file (`--customPreset` param) that could override some or all properties in the out-of-the-box presets.

Most people would use the out-of-box preset or tune a few attributes.

The file is a hierarchical yaml object. If an attribute is defined at root level, it overrides the default value for all the affected configurations.

The attribute can also be defined in a lower level object just affecting one component (node, gateway, nemesis, etc).

The best way to validate your configuration is by inspecting the generated configuration and preset.yml files in the target folder

**If you are trying new configurations, remember to reset the previous one by running --reset (-r) or by removing the selected target folder (./target by default)**
 
## Examples

### Custom Rest image and throttling

```yaml
symbolRestImage: symbolplatform/symbol-rest:2.3.2
throttlingBurst: 35
throttlingRate: 1000
```

### Custom block duration, max namespace duration and number of nemesis accounts

```yaml
blockGenerationTargetTime: 5s
maxNamespaceDuration: 10d
nemesis:
    mosaics:
        - accounts: 20
```

### Zero fee nodes

```yaml
minFeeMultiplier: 0
```

### Not exposed rest gateway

```yaml
gateways:
    - openPort: false
```

### Custom nodes' friendly names and hosts

Updating first node (single node presets like `testnet`):

```yaml
nodes:
    - friendlyName: My node custom friendly name
      host: 'myNode.custom.hostname'
```

Updating multiple nodes (multi-node presets like `bootstrap`)

```yaml
nodes:
    - friendlyName: Peer Node 1 custom friendly name
    - friendlyName: Peer Node 2 custom friendly name
      host: 'peer2.custom.hostname'
    - friendlyName: Api Node 1 custom friendly name
      host: 'api1.custom.hostname'
```

### Custom generation hash seed, balances and block 1 transactions

```yaml
nemesisGenerationHashSeed: 7391E2EF993C70D2F52691A54411DA3BD1F77CF6D47B8C8D8832C890069AAAAA
nemesis:
    balances:
        TDN2CNADENSTASFK6SCB7MFQLAYNZB3JBZCBLLA: 898300000
        TBK7C5SI3NR3ZEZTMNXRISY6FENDK3YDE63HK7Q: 98800000
        TA45K3WZYQQKSFHJ3DSEQTOO6N7RMBQUVE7H6MA: 984750000
transactions:
    '16963_581474': A1000000000000...(serialized hex transaction)
    '16963_580690': A1000000000000...
    'MyTransaction': 01000000000000...
```

### Use main account as the harvester account.

For security reasons, Bootstrap doesn't use the main account as the harvester account by default. Instead, Bootstrap generates a remote account that would need to be linked to the main account. 
Like with VRF and Voting keys, the linking (`AccountKeyLinkTransaction`) process is included in the nemesis block for new networks or can be issued via the `link` command for nodes connected to existing networks. 

Both main and remote accounts will be reported in the `addresses.yml` file

If you want to use your main account as the harvesting account, you can disable this feature with the following preset:

```yaml
nodeUseRemoteAccount: false
```
**Warning:** Disabling the remote account is not recommended as it exposes your main account's private key in the node's configuration files.

### Enable voting mode in a node

```yaml
nodes:
    - voting: true
```

In order to finalize the peer or voting nodes registration to an existing network like Testnet, be sure your nodes' signing addresses have enough funds. For test environments, you can use the network's faucet.

Then run:

```
symbol-bootstrap link
```

**Note:** Full network `-p bootstrap` nodes are fully configured voting and peer nodes. `VotingKeyLinkTransaction` and `VrfKeyLinkTransaction` are added to the nemesis block automatically.

### Specify the Nodes' keys.

If you know the private keys of your node, you can provide them in a custom preset:

```yaml
nodes:
  - voting: true
    mainPrivateKey: CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD
    transportPrivateKey: 6154154096354BC3DB522174ACD8BFE553893A0991BD5D105599846F17A3383B
    remotePrivateKey: E27AD508907524E2143EF2A3A272DDBEE7558B92550ABA5B82AD65D66B57BD00
    vrfPrivateKey: F3C24C153783B683E40FB2671493B54480370BF4E3AB8027D4BF1293E14EB9B8
    votingPrivateKey: EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1
```

Usage examples:
- Rebuild one of your Testnet/Main nodes. 
- Create a new node from migrated opted in accounts (included VRF).

Keep the generated `addresses.yml` and `preset.yml` in the target folder privately!

### Specify the Network's keys.

If you want to replicate the nemesis block and generation hash of your private bootstrap network, you can specify the nemesis keys:

```yaml
nemesisGenerationHashSeed: 6C1B92391CCB41C96478471C2634C111D9E989DECD66130C0430B5B8D20117CD
nemesis:
  nemesisSignerPrivateKey: B2AF9675B7AA8CCCBB3C1072256B3DF7354223FB5C490FFBDDB1C60696E25219
```

Usage examples:
- Rebuild a network with the same previous configuration.
- Replicate integration tests that may use specific values.

Keep the generated `addresses.yml` and `preset.yml` in the target folder privately!

### Disable voting mode in all bootstrap nodes

```yaml
nodes:
    - voting: false
    - voting: false
```

### Add docker-compose properties to services

Fields added in `compose` object inside the different services like `databases`, `nodes`, etc will be added to the generated docker-compose's services

A custom preset like:

```yaml
nodes:
    - compose:
          cpu_count: 4
          shm_size: 64M
          deploy:
              resources:
                  limits:
                      memory: 4G
```

will generate a docker service like:

```yaml
  peer-node-0:
        container_name: peer-node-0
        image: 'symbolplatform/symbol-server:gcc-0.10.0.6'
        .......
        cpu_count: 4
        shm_size: 64M
        deploy:
            resources:
                limits:
                    memory: 4G
```

### Repeat components

```yaml
# custom repeat preset for bootstrap preset.
databases:
    - repeat: 4
nodes:
    - repeat: 3
      name: 'my-custom-peer-node-{{$index}}'
    - repeat: 4
      name: 'my-custom-api-node-{{$index}}'
      friendlyName: 'my-custom-{{$index}}-friendly-name'
gateways:
    - repeat: 4
      apiNodeName: 'my-custom-api-node-{{$index}}'
      ipv4_address: '172.20.0.{{add $index 20}}',
```

`Repeat` is a pretty powerful customization. It tells bootstrap to "repeat" the defined configuration a number of times. This will allow you to generate as many services as you want quickly.

This is specially useful for:

-   Configure a really large network. The generated configuration could be then deployed into different cloud services.
-   Load test many services together to validate how they behave.
-   Exclude a service via `repeat: 0`.

If repeat is active, each value in the object is a [handlebars](https://handlebarsjs.com/guide/expressions.html) template. `$index` is the index of the generated service starting from 0. 

Given an `$index` of 10:
- `my-custom-peer-node-{{$index}}` will become `my-custom-peer-node-10`
- `172.20.0.{{add $index 20}}` will become `172.20.0.30`

The default preset `bootstrap` uses repeat but with just 1 database, 2 peers, 1 api and 1 rest gateway.


### Disable a service

It's possible `remove` a service from an out-of-the-box preset. You can achieve that at different levels. In this case, I would like to remove the rest `gateways:`. The same idea applies to `databases:` and `nodes:` preset services.

**Exclude the configuration generation and docker service from compose**

```yaml
gateways:
 - repeat: 0
```

**Create the configuration but exclude the service from compose**

```yaml
gateways:
 - excludeDockerService: true
```

**Create the configuration, docker compose service, and run the service but exclude localhost port from opening**

```yaml
gateways:
 - openPort: false
```

**Create the configuration and docker compose service but exclude the service from running**

This is done by passing [docker-compose up](https://docs.docker.com/compose/reference/up) params through bootstrap via `--args`.

```
symbol-bootstrap start -r --args "--scale rest-gateway-0=0"
```

### Enable compose debug mode

It adds debug attributes to the docker compose services. The attributes are:

```
security_opt:
    - 'seccomp:unconfined'
cap_add:
    - ALL
privileged: true 
```

By default, debug mode is disabled. You can enable debug mode in each service.

````
gateways:
    - dockerComposeDebugMode: true # debug mode in gateway
nodes:
    - dockerComposeDebugMode: true # debug mode in node
      brokerDockerComposeDebugMode: true # debug mode in broker
````

Alternatively, you can enable debug mode for all the services, but then disable them by one by. 


````
dockerComposeDebugMode: true # adds debug mode attributes to all the services
databases:
    - dockerComposeDebugMode: false # excluding the database
nodes:
    - brokerDockerComposeDebugMode: false # excluding the broker
````

