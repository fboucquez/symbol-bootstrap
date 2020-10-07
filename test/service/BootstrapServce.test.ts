import 'mocha';
import { BootstrapService, Preset, StartParams } from '../../src/service';
import { expect } from '@oclif/test';

describe('BootstrapService', () => {
    it(' bootstrap config compose non aws', async () => {
        const service = new BootstrapService('.');
        const config: StartParams = {
            report: false,
            preset: Preset.bootstrap,
            reset: true,
            timeout: 60000 * 5,
            target: 'target/BootstrapService.standard',
            detached: true,
            user: 'current',
        };

        const configResult = await service.config(config);
        expect(configResult.presetData).to.not.null;
        expect(configResult.addresses).to.not.null;
        const dockerCompose = await service.compose(config);
        expect(dockerCompose).to.not.undefined;
    });
});
