`symbol-bootstrap renewCertificates`
====================================

It renews the SSL certificates of the node regenerating the node.csr.pem files but reusing the current private keys.

The certificates are only regenerated when they are closed to expiration (30 days). If you want to renew anyway, use the --force param.

This command does not change the node private key (yet). This change would require a harvesters.dat migration and relinking the node key.

It's recommended to backup the target folder before running this operation!

* [`symbol-bootstrap renewCertificates`](#symbol-bootstrap-renewcertificates)

## `symbol-bootstrap renewCertificates`

It renews the SSL certificates of the node regenerating the node.csr.pem files but reusing the current private keys.

```
USAGE
  $ symbol-bootstrap renewCertificates

OPTIONS
  -c, --customPreset=customPreset  This command uses the encrypted addresses.yml to resolve the main and transport
                                   private key. If the main and transport privates are only stored in the custom preset,
                                   you can provide them using this param. Otherwise, the command may ask for them when
                                   required.

  -h, --help                       It shows the help of this command.

  -t, --target=target              [default: target] The target folder where the symbol-bootstrap network is generated

  -u, --user=user                  [default: current] User used to run docker images when generating the certificates.
                                   "current" means the current user.

  --force                          Renew the certificates even though they are not close to expire.

  --logger=logger                  [default: Console,File] The loggers the command will use. Options are:
                                   Console,File,Silent. Use ',' to select multiple loggers.

  --noPassword                     When provided, Bootstrap will not use a password, so private keys will be stored in
                                   plain text. Use with caution.

  --password=password              A password used to encrypt and decrypt private keys in preset files like
                                   addresses.yml and preset.yml. Bootstrap prompts for a password by default, can be
                                   provided in the command line (--password=XXXX) or disabled in the command line
                                   (--noPassword).

DESCRIPTION
  The certificates are only regenerated when they are closed to expiration (30 days). If you want to renew anyway, use 
  the --force param.

  This command does not change the node private key (yet). This change would require a harvesters.dat migration and 
  relinking the node key.

  It's recommended to backup the target folder before running this operation!

EXAMPLE
  $ symbol-bootstrap renewCertificates
```

_See code: [src/commands/renewCertificates.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v1.1.7/src/commands/renewCertificates.ts)_
