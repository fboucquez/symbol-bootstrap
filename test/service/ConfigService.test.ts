import 'mocha';
import { ConfigService, Preset } from '../../src/service';
import { expect } from '@oclif/test';

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

    it('ConfigService bootstrap repeat', async () => {
        const configResult = await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            target: 'target/ConfigService.bootstrap.repeat',
            preset: Preset.bootstrap,
            customPreset: './test/repeat_preset.yml',
        }).run();

        const assertRepeatedService = (expectedCount: number, services: any[] | undefined) => {
            expect(services!.length).to.be.eq(expectedCount);

            services?.forEach((service) => {
                Object.values(service).forEach((value) => {
                    expect((value + '').indexOf('index'), `'${value}' contains index!`).to.be.eq(-1);
                });
            });
        };

        assertRepeatedService(4, configResult.presetData.databases);
        assertRepeatedService(7, configResult.presetData.nodes);
        assertRepeatedService(4, configResult.presetData.gateways);
        assertRepeatedService(4, configResult.presetData.databases);
    });
});
