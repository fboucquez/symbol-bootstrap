`symbol-bootstrap enrolRewardProgram`
=====================================

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address.  You can also use this command to update the program registration when you change the node public key or server host.

Currently, the only program that can be enrolled post-launch is 'SuperNode'.

* [`symbol-bootstrap enrolRewardProgram`](#symbol-bootstrap-enrolrewardprogram)

## `symbol-bootstrap enrolRewardProgram`

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address.  You can also use this command to update the program registration when you change the node public key or server host.

```
USAGE
  $ symbol-bootstrap enrolRewardProgram

OPTIONS
  -h, --help              It shows the help of this command.
  -t, --target=target     [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url           [default: http://localhost:3000] the network url

  --maxFee=maxFee         the max fee used when announcing (absolute). The node min multiplier will be used if it is not
                          provided.

  --noPassword            When provided, Bootstrap will not use a password, so private keys will be stored in plain
                          text. Use with caution.

  --password=password     A password used to encrypt and decrypted custom presets, addresses.yml, and preset.yml files.
                          When providing a password, private keys would be encrypted. Keep this password in a secure
                          place!

  --ready                 If --ready is provided, the command will not ask for confirmation when announcing
                          transactions.

  --useKnownRestGateways  Use the best NEM node available when announcing. Otherwise the command will use the node
                          provided by the --url parameter.

DESCRIPTION
  Currently, the only program that can be enrolled post-launch is 'SuperNode'.

EXAMPLES
  $ symbol-bootstrap enrolRewardProgram
  $ symbol-bootstrap enrolRewardProgram --noPassword
  $ symbol-bootstrap enrolRewardProgram --useKnownRestGateways
  $ symbol-bootstrap enrolRewardProgram --password 1234 --url http://external-rest:3000
  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap enrolRewardProgram --url http://external-rest:3000
```

_See code: [src/commands/enrolRewardProgram.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/enrolRewardProgram.ts)_
