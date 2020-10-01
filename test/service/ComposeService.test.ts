import 'mocha';
import { BootstrapService, BootstrapUtils, ConfigService, Preset } from '../../src/service';
import { LinkService } from '../../src/service/LinkService';
import { expect } from '@oclif/test';
import { existsSync } from 'fs';
import { join } from 'path';
import { DockerCompose } from '../../src/model/DockerCompose';

describe('ComposeService', () => {
    it('Compose testnet', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual',
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',
        };

        const service = new BootstrapService('.');
        const configResult = await service.config(params);
        const dockerCompose = await service.compose(params, configResult.presetData);
        const targetDocker = join(params.target, `docker`, 'docker-compose.yml');
        expect(existsSync(targetDocker)).to.be.true;
        const expectedDockerCompose: DockerCompose = BootstrapUtils.loadYaml('./test/expected-testnet-dual-compose.yml');

        const promises = Object.values(expectedDockerCompose.services).map(async (service) => {
            const user = await BootstrapUtils.getDockerUserGroup();
            if (user) {
                service.user = user;
            } else {
                delete service.user;
            }
        });
        await Promise.all(promises);
        expect(dockerCompose).to.be.deep.eq(expectedDockerCompose);
    });
});
