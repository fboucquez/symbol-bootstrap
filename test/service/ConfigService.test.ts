import 'mocha';
import { ConfigService } from '../../src/service/ConfigService';

// describe('ConfigService', () => {
//     it('ConfigService default run', async () => {
//         await new ConfigService({ ...ConfigService.defaultParams, reset: true }).run();
//     });
// });

describe('ConfigService', () => {
    it('ConfigService default run with custom preset', async () => {
        await new ConfigService({ ...ConfigService.defaultParams, reset: true, customPreset: './test/optin_preset.yml' }).run();
    });
});
