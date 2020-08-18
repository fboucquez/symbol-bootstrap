import 'mocha';

// eslint-disable-next-line @typescript-eslint/no-var-requires

import { ForgeCertificateService } from '../../src/service/ForgeCertificateService';
import { BootstrapUtils } from '../../src/service';

describe('CertificateService', () => {
    it('forge create certificate', async () => {
        await BootstrapUtils.deleteFolder('./target/unitTests');
        const service = new ForgeCertificateService({ target: './target/unitTests' });
        await service.run('peer-node');
    });
});
