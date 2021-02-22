`symbol-bootstrap compose`
==========================

It generates the `docker-compose.yml` file from the configured network.

* [`symbol-bootstrap compose`](#symbol-bootstrap-compose)

## `symbol-bootstrap compose`

It generates the `docker-compose.yml` file from the configured network.

```
USAGE
  $ symbol-bootstrap compose

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated

  -u, --user=user      [default: current] User used to run the services in the docker-compose.yml file. "current" means
                       the current user.

  --noPassword         When provided, Bootstrap will not use a password, so private keys will be stored in plain text.
                       Use with caution.

  --password=password  A password used to encrypt and decrypted custom presets, addresses.yml, and preset.yml files.
                       When providing a password, private keys would be encrypted. Keep this password in a secure place!

  --upgrade            It regenerates the docker compose and utility files from the <target>/docker folder

EXAMPLE
  $ symbol-bootstrap compose
```

_See code: [src/commands/compose.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/compose.ts)_
