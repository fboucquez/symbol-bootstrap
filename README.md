# symbol-bootstrap

Symbol CLI tool that allows you creating, configuring and running Symbol&#39;s complete networks or nodes to be sync with existing networks.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/symbol-bootstrap.svg)](https://npmjs.org/package/symbol-bootstrap)
[![Downloads/week](https://img.shields.io/npm/dw/symbol-bootstrap.svg)](https://npmjs.org/package/symbol-bootstrap)
[![License](https://img.shields.io/npm/l/symbol-bootstrap.svg)](https://github.com/fboucquez/symbol-bootstrap/blob/master/package.json)
[![Build Status](https://travis-ci.com/fboucquez/symbol-bootstrap.svg?branch=main)](https://travis-ci.com/fboucquez/symbol-bootstrap)
[![Coverage Status](https://coveralls.io/repos/github/fboucquez/symbol-bootstrap/badge.svg?branch=main)](https://coveralls.io/github/fboucquez/symbol-bootstrap?branch=main)
[![Api Doc](https://img.shields.io/badge/api-doc-blue.svg)](https://fboucquez.github.io/symbol-bootstrap/)


<!-- toc -->
* [symbol-bootstrap](#symbol-bootstrap)
* [Why this tool?](#why-this-tool)
* [Key benefits:](#key-benefits)
* [Concepts](#concepts)
* [Requirements](#requirements)
* [Usage](#usage)
* [E2E Testing support](#e2e-testing-support)
* [Commands](#commands)
<!-- tocstop -->

# Why this tool?

This tool has been created to address the problems defined in Symbol's [NIP11](https://github.com/nemtech/NIP/blob/main/NIPs/nip-0011.md).

Ideally, it should replace:

-   [catapult-service-bootstrap](https://github.com/nemtech/catapult-service-bootstrap)
-   [symbol-testnet-bootstrap](https://github.com/nemgrouplimited/symbol-service-bootstrap)

# Key benefits:

-   It's an installable cli tool. It's not a repo you need to clone and compile.
-   The configuration is parametrized via CLI commands and presets instead of by changing properties files.
-   The tools code is unique for any type of network, new networks or nodes in a network. It doesn't need to be copied and pasted in different projects or assemblies.
-   The config command runs on the host machine, not via docker making it easier to debug or tune
-   It's uses the TS SDK for key generation, vrf transactions, address generation instead of using catapult-tools (nemgen is still used to generate the nemesis block).
-   Easier to maintain, the properties files are reused for all nodes, assemblies and network types.
-   Network setup (how many database, nodes, rest gateways to run) is defined in presets, users can provide their own ones.
-   Docker-compose.yaml files are generated based on the network setup/preset instead of being manually created/upgraded.
-   The created network (config, nemesis and docker-compose) can be zipped and distributed for other host machines to run it.
-   The used docker images versions can be changed via configuration/preset
-   It uses the [oclif](https://oclif.io) framework. New commands are easy to add and document.
-   It can be included as a npm dependency for clients' e2e testing.

# Concepts

## Preset:

Yaml files that define the configuration and layout of the network and nodes. It defines how many nodes, database, rest gateways, the modes, keys, etc.

Presets are defined at 4 levels from general to specific:

-   Shared: Default configurations for all the networks.
-   Network: It defines the main preset of a given network, example: `bootstrap` or `testnet`.
-   Assembly: It defines a modification of a network, example: `testnet peer`, `tesnet dual`, `testnet api`. Assembly is required for some networks (like `testnet`).
-   Custom: A user provided yml file (`--customPreset` param) that could override some or all properties in the out-of-the-box presets.

Properties in each file override the previous values (by shallow object merge).

### Out-of-the-box presets:

-   `-p botstrap`: Default [preset](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/bootstrap/network.yml). It's a full network with 1 mongo database, 2 peers, 1 api and 1 rest gateway. Nemesis block is generated.
-   `-p light`: A [light](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/light/network.yml) network. It's a version of bootstrap with 1 mongo database, 1 dual peer and 1 rest gateway. Great for faster light e2e automatic testing. Nemesis block is generated.
-   `-p testnet -a peer`: A [haversting](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/assembly-peer.yml) peer node that connects to the current public [testnet](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/network.yml). [Nemesis block](https://github.com/fboucquez/symbol-bootstrap/tree/main/presets/testnet/seed/00000) is copied over.
-   `-p testnet -a api`: A [api](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/assembly-api.yml) peer node that connects to the current public [testnet](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/network.yml) running its own mongo database and rest gateway. [Nemesis block](https://github.com/fboucquez/symbol-bootstrap/tree/main/presets/testnet/seed/00000) is copied over.
-   `-p testnet -a dual`: A [dual](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/assembly-dual.yml) haversting peer node that connects to the current public [testnet](https://github.com/fboucquez/symbol-bootstrap/blob/main/presets/testnet/network.yml) running its own mongo database and rest gateway. [Nemesis block](https://github.com/fboucquez/symbol-bootstrap/tree/main/presets/testnet/seed/00000) is copied over.

## Target:

The folder where the generated config, docker files and data are stored. The folder structure is:

-   `./config`: node configurations mounted when running the docker services.
-   `./config/generated-addresses`: randomly generated data that wasn't provided in the preset. e.g.: SSL keys, nodes' keys, nemesis accounts, generation hash seed, etc.
-   `./config/nemesis`: the configuration used when running the `nemgen` tool.
-   `./mongo`: mongo database data
-   `./data`
-   `./data/nemesis-data`: nemesis data the nodes will load. The nemesis can be generated (for new networks like `bootstrap`) or copied from an existing network (`testnet`)
-   `./docker`: the generated docker-compose.yml and DockerFile files used when running the network.
-   `./state`: folder used to synchronize the services execution

# Requirements

-   NPM 10+
-   docker

# Usage

It's recommended to run the commands from en empty working dir.

The network configuration, data and docker files will be created inside the target folder ('./target') by default.

```
mkdir my-networks
cd my-networks
```

Once in the working dir:

<!-- usage -->
```sh-session
$ npm install -g symbol-bootstrap
$ symbol-bootstrap COMMAND
running command...
$ symbol-bootstrap (-v|--version|version)
symbol-bootstrap/0.0.0-alpha-202008211310 linux-x64 node-v12.16.3
$ symbol-bootstrap --help [COMMAND]
USAGE
  $ symbol-bootstrap COMMAND
...
```
<!-- usagestop -->

The general usage would be:

```
symbol-bootstrap config -p bootstrap
symbol-bootstrap compose
symbol-bootstrap run
```

You can aggregate all these commands with this one liner:

```
symbol-bootstrap start -p bootstrap
```

If you need to start fresh, you many need to sudo remove the target folder (docker volumes dirs may be created using sudo). Example:

```
sudo rm -rf ./target
```

# E2E Testing support

One use case of this CLI is client E2E testing support. If you are coding a Symbol client, you (Travis or Jenkins) can run e2e tests like:

```
symbol-bootstrap start -p bootstrap --daemon
YOUR TEST (e.g: npm run test, gradle test, selenium etc.)
symbol-bootstrap stop
```

`--daemon` starts the server waiting until is up (by polling the network http://localhost:3000/node/health). The command will fail if the components are not up in 30 seconds

You can also provide your own custom preset (`-c`) if you want your e2e test to start with a specific state (specific balances addresses, mosaics, namespaces, generation hash seed, etc.)

## Node client E2E via CLI:

The CLI can also be used as npm project (dev) dependency (`npm install --save-dev symbol-bootstrap`). Then you can integrate the network to your npm test cycle.
Your `package.json` can look like this:

````

"devDependencies": {
    ....
    "symbol-bootstrap": "0.0.x",
    ....
}

scripts": {
...
    "clean-network": "symbol-bootstrap clean",
    "run-network": "symbol-bootstrap start -c ./output/my_custom_preset.yml --daemon",
    "run-stop": "symbol-bootstrap stop",
    "integration-test": "....some mocha/jest/etc tests running against localhost:3000 network....",
    "e2e": "npm run clean-network && npm run run-network && npm run integration-test && npm run stop-network",
...
}
````

Then, you, Jenkins, Travis or your CI tool can run;

```
npm run e2e
```


## Node client E2E via API:

Alternative, you can use the [BootstrapService](https://github.com/fboucquez/symbol-bootstrap/blob/main/src/service/BootstrapService.ts) facade to programmatically start and stop a server.

Example:

```
it('Bootstrap e2e test', async () => {
    const service = new BootstrapService();
    const config: StartParams = {
        preset: Preset.bootstrap,
        reset: true,
        timeout: 60000 * 5,
        target: 'target/bootstrap-test',
        daemon: true,
        user: 'current',
    };
    try {
        await service.stop(config);
        const configResult = await service.start(config);
        expect(configResult.presetData).not.null;
        expect(configResult.addresses).not.null;
        // Here you can write unit tests against a http://localhost:3000 network
    } finally {
        await service.stop(config);
    }
});
```

It's recommended to reuse the same server for multiple tests by using `beforeAll`, `afterAll` kind of statements. 


# Commands

<!-- commands -->
* [`symbol-bootstrap clean`](#symbol-bootstrap-clean)
* [`symbol-bootstrap compose`](#symbol-bootstrap-compose)
* [`symbol-bootstrap config`](#symbol-bootstrap-config)
* [`symbol-bootstrap help [COMMAND]`](#symbol-bootstrap-help-command)
* [`symbol-bootstrap run`](#symbol-bootstrap-run)
* [`symbol-bootstrap start`](#symbol-bootstrap-start)
* [`symbol-bootstrap stop`](#symbol-bootstrap-stop)

## `symbol-bootstrap clean`

It removes the target folder (It may not work if you need root!!!)

```
USAGE
  $ symbol-bootstrap clean

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] the target folder

EXAMPLE
  $ symbol-bootstrap clean
```

_See code: [src/commands/clean.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/clean.ts)_

## `symbol-bootstrap compose`

It generates the docker-compose.yml file from the configured network.

```
USAGE
  $ symbol-bootstrap compose

OPTIONS
  -h, --help           It shows the help of this command.
  -r, --reset          It resets the configuration generating a new one
  -t, --target=target  [default: target] the target folder

  -u, --user=user      [default: current] User used to run the services in the docker-compose.yml file. "current" means
                       the current user.

EXAMPLE
  $ symbol-bootstrap compose
```

_See code: [src/commands/compose.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/compose.ts)_

## `symbol-bootstrap config`

Command used to set up the configuration files and the nemesis block for the current network

```
USAGE
  $ symbol-bootstrap config

OPTIONS
  -a, --assembly=assembly                 An optional assembly type, example "dual" for testnet

  -c, --customPreset=customPreset         External preset file. Values in this file will override the provided presets
                                          (optional)

  -h, --help                              It shows the help of this command.

  -p, --preset=(bootstrap|testnet|light)  [default: bootstrap] the network preset

  -r, --reset                             It resets the configuration generating a new one

  -t, --target=target                     [default: target] the target folder

EXAMPLE
  $ symbol-bootstrap config -p bootstrap
```

_See code: [src/commands/config.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/config.ts)_

## `symbol-bootstrap help [COMMAND]`

display help for symbol-bootstrap

```
USAGE
  $ symbol-bootstrap help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

## `symbol-bootstrap run`

This command runs this network from the created configuration and docker-compose.yml file.

```
USAGE
  $ symbol-bootstrap run

OPTIONS
  -b, --build            If provided, docker-compose will run with -b (--build)

  -d, --daemon           If provided, docker-compose will run with -d (--detached) and this command will wait unit
                         server is running before returning

  -h, --help             It shows the help of this command.

  -t, --target=target    [default: target] the target folder

  -t, --timeout=timeout  [default: 60000] If running in daemon mode, how long before timing out (in MS)

EXAMPLE
  $ symbol-bootstrap run
```

_See code: [src/commands/run.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/run.ts)_

## `symbol-bootstrap start`

Single command that aggregates config, compose and run in one liner!

```
USAGE
  $ symbol-bootstrap start

OPTIONS
  -a, --assembly=assembly                 An optional assembly type, example "dual" for testnet
  -b, --build                             If provided, docker-compose will run with -b (--build)

  -c, --customPreset=customPreset         External preset file. Values in this file will override the provided presets
                                          (optional)

  -d, --daemon                            If provided, docker-compose will run with -d (--detached) and this command
                                          will wait unit server is running before returning

  -h, --help                              It shows the help of this command.

  -p, --preset=(bootstrap|testnet|light)  [default: bootstrap] the network preset

  -r, --reset                             It resets the configuration generating a new one

  -t, --target=target                     [default: target] the target folder

  -t, --timeout=timeout                   [default: 60000] If running in daemon mode, how long before timing out (in MS)

  -u, --user=user                         [default: current] User used to run the services in the docker-compose.yml
                                          file. "current" means the current user.

EXAMPLES
  $ symbol-bootstrap start
  $ symbol-bootstrap start -p bootstrap
  $ symbol-bootstrap start -p testnet -a dual
```

_See code: [src/commands/start.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/start.ts)_

## `symbol-bootstrap stop`

It stops the docker-compose network if it's running (example, when symbol-bootstrap start --daemon).

```
USAGE
  $ symbol-bootstrap stop

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] the target folder

EXAMPLE
  $ symbol-bootstrap stop
```

_See code: [src/commands/stop.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v0.0.0-alpha-202008211310/src/commands/stop.ts)_
<!-- commandsstop -->
```
