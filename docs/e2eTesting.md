# E2E Testing support

One use case of this CLI is client E2E testing support. If you are coding a Symbol client, you (Travis or Jenkins) can run e2e tests like:

```shell
symbol-bootstrap start -p bootstrap -a dual -c my_custom_preset.yml --detached --healthCheck
# YOUR TEST (e.g: npm run test, gradle test, selenium etc.)
symbol-bootstrap stop
```

`--detached` starts the server waiting until it is up (by polling the network http://localhost:3000/node/health). The command will fail if the components are not up in 30 seconds.

You can also provide your own custom preset (`-c`) if you want your e2e test to start with a specific state (specific balances addresses, mosaics, namespaces, generation hash seed, etc.)

## Node client E2E via CLI:

The CLI can also be used as npm project (dev) dependency (`npm install --save-dev symbol-bootstrap`). Then you can integrate the network to your npm test cycle.
Your `package.json` can look like this:

```yaml

"devDependencies": {
    ....
    "symbol-bootstrap": "0.0.x",
    ....
}

scripts": {
...
    "clean-network": "symbol-bootstrap clean",
    "run-network": "symbol-bootstrap start -p bootstrap -a dual -c my_custom_preset.yml --detached --healthCheck",
    "run-stop": "symbol-bootstrap stop",
    "integration-test": "....some mocha/jest/etc tests running against localhost:3000 network....",
    "e2e": "npm run clean-network && npm run run-network && npm run integration-test && npm run stop-network",
...
}
```

Then, you, Jenkins, Travis or your CI tool can run;

```shell
npm run e2e
```

## Node client E2E via API:

Alternatively, you can use the [BootstrapService](src/service/BootstrapService.ts) facade to programmatically start and stop a server.

Example:

```ts
import {BootstrapService, StartParams, Preset} from 'symbol-bootstrap';
import {expect} from '@oclif/test';

it('Bootstrap e2e test', async () => {
    const service = new BootstrapService();
    const config: StartParams = {
        preset: Preset.bootstrap,
        reset: true,
        healthCheck: true,
        timeout: 60000 * 5,
        target: 'target/bootstrap-test',
        detached: true,
        user: 'current',
    };
    try {
        await service.stop(config);
        const configResult = await service.start(config);
        expect(configResult.presetData).not.null;
        expect(configResult.addresses).not.null;
        // Here you can write unit tests against a http://localhost:3000 network
    } finally {
        await service.stop(config);
    }
});
```

It's recommended to reuse the same server for multiple tests by using `beforeAll`, `afterAll` kind of statements.
