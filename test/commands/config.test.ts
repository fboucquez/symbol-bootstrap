import { test } from '@oclif/test';

describe('config', () => {
    test.stdout()
        .command(['config', '-r'])
        .it('runs config', (ctx) => {
            console.log(ctx.stdout);
        });
});

describe('config with opt in', () => {
    test.stdout()
        .command(['config', '-r', '-c', './test/optin_preset.yml'])
        .it('runs config', (ctx) => {
            console.log(ctx.stdout);
        });
});
