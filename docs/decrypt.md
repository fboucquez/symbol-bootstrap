`symbol-bootstrap decrypt`
==========================

It decrypts a yml file using the provided password. The source files would be a custom preset file, a preset.yml file or an addresses.yml.

The main use case of this command is to verify private keys in encrypted files after encrypting a custom preset or running a bootstrap command with a provided --password.

Example:
symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
symbol-bootstrap decrypt --password 1234 --source target/addresses.yml --destination plain-addresses.yml
symbol-bootstrap decrypt --password 1234 --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
cat plain-addresses.yml
cat plain-custom-preset.yml
rm plain-addresses.yml
rm plain-custom-preset.yml

* [`symbol-bootstrap decrypt`](#symbol-bootstrap-decrypt)

## `symbol-bootstrap decrypt`

It decrypts a yml file using the provided password. The source files would be a custom preset file, a preset.yml file or an addresses.yml.

```
USAGE
  $ symbol-bootstrap decrypt

OPTIONS
  -h, --help                 It shows the help of this command.

  --destination=destination  (required) The destination where the decrypted file will be stored. The destination file
                             must not exist.

  --source=source            (required) The source plain yml file to be decrypted. If this file is not decrypted, the
                             command will raise an error.

DESCRIPTION
  The main use case of this command is to verify private keys in encrypted files after encrypting a custom preset or 
  running a bootstrap command with a provided --password.

  Example:
  symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml 
  --detached
  symbol-bootstrap decrypt --password 1234 --source target/addresses.yml --destination plain-addresses.yml
  symbol-bootstrap decrypt --password 1234 --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
  cat plain-addresses.yml
  cat plain-custom-preset.yml
  rm plain-addresses.yml
  rm plain-custom-preset.yml

EXAMPLE
  $ symbol-bootstrap decrypt --password 1234 --source plain-custom-preset.yml --destination decrypted-custom-preset.yml
```

_See code: [src/commands/decrypt.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/decrypt.ts)_
