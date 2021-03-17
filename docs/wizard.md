`symbol-bootstrap wizard`
=========================

An utility command that will help you configuring node!

* [`symbol-bootstrap wizard`](#symbol-bootstrap-wizard)

## `symbol-bootstrap wizard`

An utility command that will help you configuring node!

```
USAGE
  $ symbol-bootstrap wizard

OPTIONS
  -h, --help                                It shows the help of this command.

  -t, --target=target                       [default: target] The target folder where the symbol-bootstrap network is
                                            generated

  --customPresetFile=customPresetFile       [default: custom-preset.yml] The custom preset to be created.

  --network=mainnet|testnet|privateNetwork  The node or network you want to create

  --noPassword                              When provided, Bootstrap will not use a password, so private keys will be
                                            stored in plain text. Use with caution.

  --password=password                       A password used to encrypt and decrypt private keys in preset files like
                                            addresses.yml and preset.yml. Bootstrap prompts for a password by default,
                                            can be provided in the command line (--password=XXXX) or disabled in the
                                            command line (--noPassword).

EXAMPLE
  $ symbol-bootstrap wizard
```

_See code: [src/commands/wizard.ts](https://github.com/nemtech/symbol-bootstrap/blob/v1.0.1/src/commands/wizard.ts)_
