import 'mocha';
import { BootstrapService, Preset, StartParams } from '../../src/service';
import { expect } from '@oclif/test';
import { existsSync } from 'fs';

describe('BootstrapService', () => {
    it(' bootstrap config compose with aws', async () => {
        const service = new BootstrapService('.');
        const config: StartParams = {
            preset: Preset.bootstrap,
            reset: true,
            aws: true,
            timeout: 60000 * 5,
            target: 'target/BootstrapService.test.aws',
            detached: true,
            user: 'current',
        };

        const configResult = await service.config(config);
        expect(configResult.presetData).to.not.null;
        expect(configResult.addresses).to.not.null;
        const dockerComposeFilePath = await service.compose(config);
        expect(existsSync(dockerComposeFilePath)).to.be.true;
    });

    it(' bootstrap config compose non aws', async () => {
        const service = new BootstrapService('.');
        const config: StartParams = {
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
        const dockerComposeFilePath = await service.compose(config);
        expect(existsSync(dockerComposeFilePath)).to.be.true;
    });
});
