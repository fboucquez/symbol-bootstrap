import 'mocha';
import { ConfigService } from '../../src/service/ConfigService';

// describe('ConfigService', () => {
//     it('ConfigService default run', async () => {
//         await new ConfigService({ ...ConfigService.defaultParams, reset: true }).run();
//     });
// });

describe('ConfigService', () => {
    it('ConfigService default run with optin_preset.yml', async () => {
        await new ConfigService('.', { ...ConfigService.defaultParams, reset: true, customPreset: './test/optin_preset.yml' }).run();
    });

    it('ConfigService default run with override-currency-preset.yml', async () => {
        await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            customPreset: './test/override-currency-preset.yml',
        }).run();
    });
});
