import 'mocha';
import { ConfigService } from '../../src/service';
import { RunService } from '../../src/service';
import { expect } from 'chai';

describe('RunService', () => {
    it('pollServiceUntilIsUp', async () => {
        const service = new RunService({ ...ConfigService.defaultParams, detached: true, build: false });
        try {
            await service.pollServiceUntilIsUp(1200, 500);
        } catch (e) {
            expect(e.message).to.equal('Network did NOT start!!!');
            return;
        }
        throw new Error('This should fail!');
    });
});
