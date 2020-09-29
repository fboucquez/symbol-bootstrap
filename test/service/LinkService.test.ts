import 'mocha';
import { BootstrapService, ConfigService, Preset } from '../../src/service';
import { LinkService } from '../../src/service/LinkService';
import { expect } from '@oclif/test';

describe('LinkService', () => {
    it('LinkService testnet', async () => {
        const params = {
            ...LinkService.defaultParams,
            target: 'target/testnet-dual',
        };
        try {
            await new BootstrapService('.').link(params);
        } catch (e) {
            expect(e.message.indexOf('ECONNREFUSED'), `Not a connection error: ${e.message}`).to.be.greaterThan(-1);
        }
    });
});
