`symbol-bootstrap decrypt`
==========================

It decrypts a yml file using the provided password. The source file can be a custom preset file, a preset.yml file or an addresses.yml.

The main use case of this command is to verify private keys in encrypted files after encrypting a custom preset or running a bootstrap command with a provided --password.

Example:
symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
symbol-bootstrap decrypt --password 1234 --source target/addresses.yml --destination plain-addresses.yml
symbol-bootstrap decrypt --password 1234 --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
cat plain-addresses.yml
cat plain-custom-preset.yml
rm plain-addresses.yml
rm plain-custom-preset.yml

Example:
symbol-bootstrap start --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
> password prompt
symbol-bootstrap decrypt --source target/addresses.yml --destination plain-addresses.yml
> password prompt (enter the same password)
symbol-bootstrap decrypt --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
> password prompt (enter the same password)
cat plain-addresses.yml
cat plain-custom-preset.yml
rm plain-addresses.yml
rm plain-custom-preset.yml

* [`symbol-bootstrap decrypt`](#symbol-bootstrap-decrypt)

## `symbol-bootstrap decrypt`

It decrypts a yml file using the provided password. The source file can be a custom preset file, a preset.yml file or an addresses.yml.

```
USAGE
  $ symbol-bootstrap decrypt

OPTIONS
  -h, --help                 It shows the help of this command.
  --destination=destination  (required) The destination decrypted file to create. The destination file must not exist.
  --source=source            (required) The source encrypted yml file to be decrypted.

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

  Example:
  symbol-bootstrap start --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
  > password prompt
  symbol-bootstrap decrypt --source target/addresses.yml --destination plain-addresses.yml
  > password prompt (enter the same password)
  symbol-bootstrap decrypt --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
  > password prompt (enter the same password)
  cat plain-addresses.yml
  cat plain-custom-preset.yml
  rm plain-addresses.yml
  rm plain-custom-preset.yml

EXAMPLE
  $ symbol-bootstrap decrypt --password 1234 --source plain-custom-preset.yml --destination decrypted-custom-preset.yml
```

_See code: [src/commands/decrypt.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/decrypt.ts)_
