`symbol-bootstrap config`
=========================

Command used to set up the configuration files and the nemesis block for the current network.

This command is by default an ONLINE tool, as it may use docker to run some operations like nemesis or certificate generation.
It's possible to run this command in OFFLINE mode, without using docker, by providing the --offline param.

Note: OFFLINE requires Linux/Mac OS, and the openssl command installed. If you are creating a new network (bootstrap preset),
the nemesis seed needs to be provided with a `nemesisSeedFolder` preset property. Nemesis generation is an online feature that requires catapult tools and docker.

* [`symbol-bootstrap config`](#symbol-bootstrap-config)

## `symbol-bootstrap config`

Command used to set up the configuration files and the nemesis block for the current network.

```
USAGE
  $ symbol-bootstrap config

OPTIONS
  -a, --assembly=assembly           An optional assembly type, example "dual" for testnet

  -c, --customPreset=customPreset   External preset file. Values in this file will override the provided presets
                                    (optional)

  -h, --help                        It shows the help of this command.

  -p, --preset=(bootstrap|testnet)  [default: bootstrap] the network preset

  -r, --reset                       It resets the configuration generating a new one

  -t, --target=target               [default: target] The target folder where the symbol-bootstrap network is generated

  -u, --user=user                   [default: current] User used to run docker images when creating configuration files
                                    like certificates or nemesis block. "current" means the current user.

  --noPassword                      When provided, Bootstrap will not use a password, so private keys will be stored in
                                    plain text. Use with caution.

  --offline                         If --offline is used, Bootstrap rejects any offline operation when generating the
                                    configuration.

  --password=password               A password used to encrypt and decrypt private keys in preset files like
                                    addresses.yml and preset.yml. Bootstrap prompts for a password by default, can be
                                    provided in the command line (--password=XXXX) or disabled in the command line
                                    (--noPassword).

  --report                          It generates reStructuredText (.rst) reports describing the configuration of each
                                    node.

  --upgrade                         It regenerates the configuration reusing the previous keys. Use this flag when
                                    upgrading the version of bootstrap to keep your node up to date without dropping the
                                    local data. The original preset (-t), assembly (-a), and custom preset (-a) must be
                                    used. Backup the target folder before upgrading.

DESCRIPTION
  This command is by default an ONLINE tool, as it may use docker to run some operations like nemesis or certificate 
  generation.
  It's possible to run this command in OFFLINE mode, without using docker, by providing the --offline param.

  Note: OFFLINE requires Linux/Mac OS, and the openssl command installed. If you are creating a new network (bootstrap 
  preset),
  the nemesis seed needs to be provided with a `nemesisSeedFolder` preset property. Nemesis generation is an online 
  feature that requires catapult tools and docker.

EXAMPLES
  $ symbol-bootstrap config -p bootstrap
  $ symbol-bootstrap config -p testnet -a dual --customPreset my-encrypted-custom-preset.yml --offline
  $ symbol-bootstrap config -p testnet -a dual --password 1234
  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap config -p testnet -a dual
```

_See code: [src/commands/config.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.5/src/commands/config.ts)_
