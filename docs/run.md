`symbol-bootstrap run`
======================

It boots the network via docker using the generated `docker-compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker-compose up` bash call.

* [`symbol-bootstrap run`](#symbol-bootstrap-run)

## `symbol-bootstrap run`

It boots the network via docker using the generated `docker-compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker-compose up` bash call.

```
USAGE
  $ symbol-bootstrap run

OPTIONS
  -b, --build            If provided, docker-compose will run with -b (--build)

  -d, --detached         If provided, docker-compose will run with -d (--detached) and this command will wait unit
                         server is running before returning

  -h, --help             It shows the help of this command.

  -s, --service=service  To start a particular docker compose service by name, example rest-gateway, db, node-peer-0

  -t, --target=target    [default: target] the target folder

  -t, --timeout=timeout  [default: 60000] If running in detached mode, how long before timing out (in MS)

EXAMPLE
  $ symbol-bootstrap run
```

_See code: [src/commands/run.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.1.1/src/commands/run.ts)_
