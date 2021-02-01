# CHANGELOG

All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.2] - Next

**Milestone**: Hippopotamus(0.10.0.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.2  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   Link command supports for `main` multisig accounts.
-   Supernode enrol command supports for `main` multisig accounts.
-   Storing downloaded artifacts (like agent binary) in the current working dir fixing issue when installing bootstrap as root.
-   Moved voting keys files from ./data to ./userconfig in the target folder.

## [0.4.1] - Jan-19-2020

**Milestone**: Hippopotamus(0.10.0.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   Improved --password. It's only required when private keys need to be read.
-   Added `database` service to server and broker `depends_on` compose services.
-   Fixed `link --unlink` command for Voting Key Link transactions.
-   Added multisig account validation to `link` and `supernode` commands.
-   Added `CONTROLLER_PUBLIC_KEY` to Supernode's agent configuration
-   Upgraded Symbol Rest to version 2.3.1.

## [0.4.0] - Jan-14-2020

**Milestone**: Hippopotamus(0.10.0.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   **Re track to catapult-server main branch**
-   Compose file version default to 2.4.
-   Fixed mongo memory usage by adding `--wiredTigerCacheSizeGB` limit.
-   Allowing users to exclude custom preset data from a compose service.
-   Basic implementation of supernode program monitoring agent. Supernode Agent installation and supernode enrol command, disabled at present, awaiting full programme implementation, preparatory step.
-   Private key in generated addresses.yml and preset.yml can be encrypted and protected by using --password.
-   Masking 64 hex keys HIDDEN_KEY on log lines.
-   Removed unused Server configuration files in the Rest container. This reduces the risk of exposing config files if the Rest machine gets compromised.

## [0.3.1] - Dec-17-2020

**Milestone**: Hippopotamus(0.10.0.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.3.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   Allowed Bootstrap to run as sudo/root. NOT RECOMMENDED!
-   Added Chmod 777 permission change to the db data folder when running as sudo/root.
-   Increased Rest's DB connection attempts and retries. This avoids Rest shutting down if the DB creation takes longer.
-   Updated Wallet to latest 0.13.6 release

## [0.3.0] - Dec-15-2020

**Milestone**: Hippopotamus(0.10.0.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.3.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   **New Service:** `Wallet`. Bootstrap private network starts a Wallet service in [http://localhost:80/](http://localhost:80/) when using `--assembly full`. . **Warning:** This wallet service is for demonstration purposes only.
-   **New Service:** `Explorer`. Bootstrap private network starts an Explorer service in [http://localhost:90/](http://localhost:90/) when using `--assembly full`.
-   **New Service:** `Faucet`. Bootstrap private network starts a Faucet service in [http://localhost:100/](http://localhost:100/) when using `--assembly full`.
-   Using remote accounts when setting up nodes by default. This improves security by avoiding main account private keys to be exposed in node configuration (like `harvesterSigningPrivateKey`).
-   Removed unnecessary tls related files once certificates are created.
-   Added addresses.yml migration from old formats.
-   Added --upgrade flag to config, compose and start.
-   Fixed api broker name in testnet's api assembly.
-   Images are not pulled by default speeding up bootstrap and avoiding unexpected alpha server upgrades. To pull new images use `--pullImages`.
-   Testnet Long Voting Key V1 and Short Voting Key V2 support.
-   Added `compose` preset support to inject properties into generated docker-compose services.

## [0.2.1] - 30-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.2.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   Fixed DB initialization.
-   Added more configurable properties.

## [0.2.0] - 21-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.2.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   **[BREAKING CHANGE]** Target folder structure has been changed for scalability. The old target folder needs to be dropped when running this version. Backup the target folder if you need to keep your data!
-   **New Command:** `symbol-bootstrap resetData` cleans the peer data and database without dropping the generated configuration.
-   **New Command:** `symbol-bootstrap healthCheck` tests if the docker compose network is running locally. `--healthCheck` param is allowed in `start` and `run` commands.
-   Allowed `repeat` on a node, a database or a gateway to instantiate them multiple times. This enables you to create large network configurations quickly.
-   Allowed `repeat` in the nemesis block's mosaic list. Harvest currency can be removed with `repeat:0`.
-   Removed preset `light`. Now it's an assembly for the bootstrap preset: `symbol-bootstrap -p bootstrap -a light`.
-   Sink addresses are generated by default.
-   Path properties are now relative folder locations. This improves reusability of the configuration when running the services outside docker compose.
-   Added node type based default configuration simplifying the configuration of nodes in presets.
-   Preset attribute `excludeDockerService: true` allows removing a service from docker-compose.
-   Configurable `trustedHosts` and `localNetworks` in config.
-   Simplified mounted volumes in compose.
-   Allowed multiple databases in compose.
-   Compose's `openPort` now accepts port number.
-   Allowed custom ip address and subnet configuration in compose.
-   Merged `db` and `db-init` services in compose. Now the mongo service knows how to init itself.

## [0.1.1] - 02-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.1.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   **New Command:** `symbol-bootstrap link` links the nodes' VRF and Voting keys to an existing network. This simplifies the node registration process to running networks like `testnet`.
-   **New Command:** `symbol-bootstrap report` generates rst and csv files from the configured server properties for documentation. Added `--report` flag to `config` and `start` commands.
-   Fixed default host names in `api` and `peer` in `testnet` preset.
-   The `voting:`, `harvesting:` and `api:` node preset flags define the node's `roles:` setting. There is no need to provide `roles:` attribute anymore.
-   Voting, signing and VRF keys, transactions and tree file are generated and announced when required depending on the node role flags.
-   Added `votingKeyDilution`, `votingKeyStartEpoch` `votingKeyEndEpoch` preset params define to voting key link transaction and tree file.
-   The field `enableDispatcherInputAuditing` is disabled by default saving disk space.
-   Added custom host configuration in docker-compose.
-   Readme and custom preset examples have been improved.
-   Allowing API custom preset object in addition to the file custom yml file.

## [0.1.0] - 26-Sep-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.1.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   0.10.0.3 catapult server support.
-   2.1.0 rest server support.
-   Improved logging configuration.
-   Allowing custom user when running config time docker images.
-   Renamed param from `--daemon` to `--detached` to keep it in line with docker compose.
-   Added `--service (-s)` to allow starting just one docker service by name.

## [0.0.0] - 14-Sep-2020

**Milestone**: Gorilla.1(0.9.6.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.0.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

-   Very first version of the tool!
