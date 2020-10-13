import 'mocha';
import { BootstrapService, BootstrapUtils, ConfigService, Preset, StartParams } from '../../src/service';
import { LinkService } from '../../src/service/LinkService';
import { expect } from '@oclif/test';
import { existsSync } from 'fs';
import { join } from 'path';
import { DockerCompose } from '../../src/model/DockerCompose';

describe('ComposeService', () => {
    const assertDockerCompose = async (params: StartParams, expectedComposeFile: string) => {
        const service = new BootstrapService('.');
        const configResult = await service.config(params);
        const dockerCompose = await service.compose(params, configResult.presetData);
        const targetDocker = join(params.target, `docker`, 'docker-compose.yml');
        expect(existsSync(targetDocker)).to.be.true;
        const expectedFileLocation = `./test/composes/${expectedComposeFile}`;
        const expectedDockerCompose: DockerCompose = BootstrapUtils.loadYaml(expectedFileLocation);

        const promises = Object.values(expectedDockerCompose.services).map(async (service) => {
            const user = await BootstrapUtils.getDockerUserGroup();
            if (user && service.user) {
                service.user = user;
            } else {
                delete service.user;
            }
        });
        await Promise.all(promises);
        expect(
            dockerCompose,
            `Generated Docker Compose:

${BootstrapUtils.toYaml(dockerCompose)}

`,
        ).to.be.deep.eq(expectedDockerCompose);
    };

    it('Compose testnet dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/testnet-dual',
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',
        };
        await assertDockerCompose(params, 'expected-testnet-dual-compose.yml');
    });

    it('Compose bootstrap default', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/bootstrap',
            reset: false,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap.yml');
    });

    it('Compose bootstrap repeat', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/ConfigService.bootstrap.repeat',
            preset: Preset.bootstrap,
            customPreset: './test/repeat_preset.yml',
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-repeat.yml');
    });
});
