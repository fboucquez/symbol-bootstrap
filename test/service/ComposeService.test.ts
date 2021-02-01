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
import { BootstrapService, BootstrapUtils, ComposeService, ConfigService, LinkService, Preset, StartParams } from '../../src/service';

describe('ComposeService', () => {
    const password = '1234';

    const assertDockerCompose = async (params: StartParams, expectedComposeFile: string) => {
        const service = new BootstrapService('.');
        const configResult = await service.config(params);
        const dockerCompose = await service.compose(params, configResult.presetData);
        Object.values(dockerCompose.services).forEach((service) => {
            if (service.mem_limit) {
                service.mem_limit = 123;
            }
        });
        const targetDocker = join(params.target, `docker`, 'docker-compose.yml');
        expect(existsSync(targetDocker)).to.be.true;
        const expectedFileLocation = `./test/composes/${expectedComposeFile}`;
        if (!existsSync(expectedFileLocation)) {
            await BootstrapUtils.writeYaml(expectedFileLocation, dockerCompose, params.password);
        }

        const expectedDockerCompose: DockerCompose = BootstrapUtils.loadYaml(expectedFileLocation, params.password);

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
            target: 'target/tests/testnet-dual',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',
        };
        await assertDockerCompose(params, 'expected-testnet-dual-compose.yml');
    });

    it('Compose testnet supernode', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-supernode',
            password,
            customPreset: './test/supernode.yml',
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',
        };
        await assertDockerCompose(params, 'expected-testnet-supernode-compose.yml');
    });

    it('Compose testnet dual voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-voting',
            password,
            reset: false,
            customPreset: './test/voting_preset.yml',
            preset: Preset.testnet,
            assembly: 'dual',
        };
        await assertDockerCompose(params, 'expected-testnet-voting-compose.yml');
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
            target: 'target/tests/ConfigService.bootstrap.default',
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
            target: 'target/tests/ConfigService.bootstrap.compose',
            password,
            customPreset: './test/custom_compose_preset.yml',
            reset: false,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-custom-compose.yml');
    });

    it('Compose bootstrap custom preset', async () => {
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
            target: 'target/tests/ConfigService.bootstrap.custom',
            customPreset: './test/custom_preset.yml',
            reset: false,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-custom.yml');
    });

    it('Compose bootstrap full with debug on', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            customPresetObject: {
                dockerComposeDebugMode: true,
                faucets: [
                    {
                        environment: { FAUCET_PRIVATE_KEY: 'MockMe', NATIVE_CURRENCY_ID: 'Mockme2' },
                    },
                ],
            },
            target: 'target/tests/ConfigService.bootstrap.full',
            password,
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
            target: 'target/tests/ConfigService.bootstrap.repeat',
            password,
            preset: Preset.bootstrap,
            customPreset: './test/repeat_preset.yml',
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-repeat.yml');
    });

    it('resolveDebugOptions', async () => {
        const service = new ComposeService('.', ComposeService.defaultParams);
        expect(service.resolveDebugOptions(true, true)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(true, undefined)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(true, false)).deep.equals({});
        expect(service.resolveDebugOptions(false, true)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(false, undefined)).deep.equals({});
        expect(service.resolveDebugOptions(false, false)).deep.equals({});
    });
});
