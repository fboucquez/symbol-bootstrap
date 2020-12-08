/*
 * Copyright 2020 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from '@oclif/test';
import { existsSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { DockerCompose } from '../../src/model';
import { BootstrapService, BootstrapUtils, ConfigService, LinkService, Preset, StartParams } from '../../src/service';

describe('ComposeService', () => {
    const assertDockerCompose = async (params: StartParams, expectedComposeFile: string) => {
        const service = new BootstrapService('.');
        const configResult = await service.config(params);
        const dockerCompose = await service.compose(params, configResult.presetData);
        const targetDocker = join(params.target, `docker`, 'docker-compose.yml');
        expect(existsSync(targetDocker)).to.be.true;
        const expectedFileLocation = `./test/composes/${expectedComposeFile}`;
        if (!existsSync(expectedFileLocation)) {
            await BootstrapUtils.writeYaml(expectedFileLocation, dockerCompose);
        }

        const expectedDockerCompose: DockerCompose = BootstrapUtils.loadYaml(expectedFileLocation);

        const promises = Object.values(expectedDockerCompose.services).map(async (service) => {
            if (!service.user) {
                return service;
            }
            const user = await BootstrapUtils.getDockerUserGroup();
            if (user) {
                service.user = user;
            } else {
                delete service.user;
            }
            return service;
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
            customPresetObject: {
                faucets: [
                    {
                        environment: { FAUCET_PRIVATE_KEY: 'MockMe', NATIVE_CURRENCY_ID: 'Mockme2' },
                    },
                ],
            },
            target: 'target/ConfigService.bootstrap.default',
            reset: false,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap.yml');
    });

    it('Compose bootstrap custom compose', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            customPresetObject: {
                faucets: [
                    {
                        environment: { FAUCET_PRIVATE_KEY: 'MockMe', NATIVE_CURRENCY_ID: 'Mockme2' },
                    },
                ],
            },
            target: 'target/ConfigService.bootstrap.compose',
            customPreset: './test/custom_compose_preset.yml',
            reset: false,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-custom-compose.yml');
    });

    it('Compose bootstrap full', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            customPresetObject: {
                faucets: [
                    {
                        environment: { FAUCET_PRIVATE_KEY: 'MockMe', NATIVE_CURRENCY_ID: 'Mockme2' },
                    },
                ],
            },
            target: 'target/ConfigService.bootstrap.full',
            reset: false,
            assembly: 'full',
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-full.yml');
    });

    it('Compose bootstrap repeat', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            customPresetObject: {
                faucets: [
                    {
                        environment: { FAUCET_PRIVATE_KEY: 'MockMe', NATIVE_CURRENCY_ID: 'Mockme2' },
                    },
                ],
            },
            reset: false,
            target: 'target/ConfigService.bootstrap.repeat',
            preset: Preset.bootstrap,
            customPreset: './test/repeat_preset.yml',
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-repeat.yml');
    });
});
