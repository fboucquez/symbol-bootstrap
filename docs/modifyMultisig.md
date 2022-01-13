`symbol-bootstrap modifyMultisig`
=================================

Create or modify a multisig account

* [`symbol-bootstrap modifyMultisig`](#symbol-bootstrap-modifymultisig)

## `symbol-bootstrap modifyMultisig`

Create or modify a multisig account

```
USAGE
  $ symbol-bootstrap modifyMultisig

OPTIONS
  -A, --addressAdditions=addressAdditions              Cosignatory accounts addresses to be added (separated by a
                                                       comma).

  -D, --addressDeletions=addressDeletions              Cosignatory accounts addresses to be removed (separated by a
                                                       comma).

  -a, --minApprovalDelta=minApprovalDelta              Delta of signatures needed to approve a transaction. 0 means no
                                                       change, a positive(+) number means increment and a negative(-)
                                                       number means decrement to the actual value.

  -c, --customPreset=customPreset                      This command uses the encrypted addresses.yml to resolve the main
                                                       private key. If the main private is only stored in the custom
                                                       preset, you can provide it using this param. Otherwise, the
                                                       command may ask for it when required.

  -h, --help                                           It shows the help of this command.

  -r, --minRemovalDelta=minRemovalDelta                Delta of signatures needed to remove a cosignatory. 0 means no
                                                       change, a positive(+) number means increment and a negative(-)
                                                       number means decrement to the actual value.

  -t, --target=target                                  [default: target] The target folder where the symbol-bootstrap
                                                       network is generated

  -u, --url=url                                        [default: http://localhost:3000] the network url

  --logger=logger                                      [default: Console] The loggers the command will use. Options are:
                                                       Console,File,Silent. Use ',' to select multiple loggers.

  --maxFee=maxFee                                      the max fee used when announcing (absolute). The node min
                                                       multiplier will be used if it is not provided.

  --noPassword                                         When provided, Bootstrap will not use a password, so private keys
                                                       will be stored in plain text. Use with caution.

  --password=password                                  A password used to encrypt and decrypt private keys in preset
                                                       files like addresses.yml and preset.yml. Bootstrap prompts for a
                                                       password by default, can be provided in the command line
                                                       (--password=XXXX) or disabled in the command line (--noPassword).

  --ready                                              If --ready is provided, the command will not ask for confirmation
                                                       when announcing transactions.

  --serviceProviderPublicKey=serviceProviderPublicKey  Public key of the service provider account, used when the
                                                       transaction announcer(service provider account) is different than
                                                       the main account private key holder

  --useKnownRestGateways                               Use the best NEM node available when announcing. Otherwise the
                                                       command will use the node provided by the --url parameter.

EXAMPLES
  $ symbol-bootstrap modifyMultisig
  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap modifyMultisig --useKnownRestGateways
```

_See code: [src/commands/modifyMultisig.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v1.1.4/src/commands/modifyMultisig.ts)_
