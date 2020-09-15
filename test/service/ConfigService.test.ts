import 'mocha';
import { ConfigService, Preset } from '../../src/service';

describe('ConfigService', () => {
    it('ConfigService default run with optin_preset.yml', async () => {
        await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/ConfigService.test.optin',
            customPreset: './test/optin_preset.yml',
        }).run();
    });

    it('ConfigService default run with override-currency-preset.yml', async () => {
        await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/ConfigService.test.custom',
            customPreset: './test/override-currency-preset.yml',
        }).run();
    });

    it('ConfigService testnet assemlby', async () => {
        await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/ConfigService.test.testnet',
            preset: Preset.testnet,
            assembly: 'dual',
        }).run();
    });
});
