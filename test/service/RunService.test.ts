import 'mocha';
import { BootstrapService, Preset, StartParams } from '../../src/service';
import { RunService } from '../../src/service';
import { expect } from 'chai';

describe('RunService', () => {
    it('healthCheck', async () => {
        const bootstrapService = new BootstrapService('.');
        const config: StartParams = {
            report: false,
            preset: Preset.bootstrap,
            reset: false,
            target: 'target/BootstrapService.standard',
            detached: true,
            build: false,
            user: 'current',
            timeout: 1200,
        };

        await bootstrapService.config(config);

        await bootstrapService.compose(config);

        const service = new RunService({ ...config });
        try {
            await service.healthCheck(500);
        } catch (e) {
            expect(e.message).to.equal('Network did NOT start!!!');
            return;
        }
        throw new Error('This should fail!');
    });
});
