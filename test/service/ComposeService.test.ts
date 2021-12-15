/*
 * Copyright 2022 Fernando Boucquez
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

import { expect } from 'chai';
import { existsSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { Assembly, Constants, FileSystemService, LoggerFactory, LogType, RuntimeService } from '../../src';
import { DockerCompose } from '../../src/model';
import { BootstrapUtils, ComposeService, ConfigLoader, ConfigService, LinkService, Preset, StartParams } from '../../src/service';
const logger = LoggerFactory.getLogger(LogType.Silent);
const fileSystemService = new FileSystemService(logger);
describe('ComposeService', () => {
    const password = '1234';

    const assertDockerCompose = async (params: StartParams, expectedComposeFile: string) => {
        const presetData = new ConfigLoader(logger).createPresetData({ password, ...params, workingDir: Constants.defaultWorkingDir });
        const dockerCompose = await new ComposeService(logger, params).run(presetData);
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
            const user = await new RuntimeService(logger).getDockerUserGroup();
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
        fileSystemService.deleteFolder(params.target);
    };

    it('Compose testnet dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: Assembly.dual,
        };
        await assertDockerCompose(params, 'expected-testnet-dual-compose.yml');
    });

    it('Compose testnet api', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-api',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: Assembly.api,
        };
        await assertDockerCompose(params, 'expected-testnet-api-compose.yml');
    });

    it('Compose testnet peer', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-peer',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: Assembly.peer,
        };
        await assertDockerCompose(params, 'expected-testnet-peer-compose.yml');
    });

    it('Compose mainnet dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/mainnet-dual',
            password,
            reset: false,
            preset: Preset.mainnet,
            assembly: Assembly.dual,
        };
        await assertDockerCompose(params, 'expected-mainnet-dual-compose.yml');
    });

    it('Compose mainnet api', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/mainnet-api',
            password,
            reset: false,
            preset: Preset.mainnet,
            assembly: Assembly.api,
        };
        await assertDockerCompose(params, 'expected-mainnet-api-compose.yml');
    });

    it('Compose mainnet peer', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/mainnet-peer',
            password,
            reset: false,
            preset: Preset.mainnet,
            assembly: Assembly.peer,
        };
        await assertDockerCompose(params, 'expected-mainnet-peer-compose.yml');
    });

    it('Compose testnet httpsProxy', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-https-proxy',
            password,
            customPreset: './test/unit-test-profiles/https-proxy.yml',
            reset: false,
            preset: Preset.testnet,
            assembly: Assembly.dual,
        };
        await assertDockerCompose(params, 'expected-testnet-httpsproxy-compose.yml');
    });

    it('Compose testnet native ssl', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-native-ssl',
            password,
            customPreset: './test/unit-test-profiles/native-ssl.yml',
            reset: false,
            preset: Preset.testnet,
            assembly: Assembly.dual,
        };
        await assertDockerCompose(params, 'expected-testnet-native-ssl-compose.yml');
    });

    it('Compose testnet dual voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/ComposeService-testnet-voting',
            password,
            reset: false,
            customPreset: './test/unit-test-profiles/voting_preset.yml',
            preset: Preset.testnet,
            assembly: Assembly.dual,
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
            target: 'target/tests/ComposeService-bootstrap.default',
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
            target: 'target/tests/ComposeService-bootstrap.compose',
            password,
            customPreset: './test/custom_compose_preset.yml',
            reset: false,
            preset: Preset.bootstrap,
            assembly: Assembly.multinode,
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
            target: 'target/tests/ComposeService-bootstrap.custom',
            customPreset: './test/custom_preset.yml',
            reset: false,
            preset: Preset.bootstrap,
            assembly: Assembly.multinode,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-custom.yml');
    });

    it('Compose bootstrap demo with debug on', async () => {
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
            target: 'target/tests/ComposeService-bootstrap.demo',
            password,
            reset: false,
            assembly: Assembly.demo,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-demo.yml');
    });
    it('Compose bootstrap dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            customPresetObject: {},
            target: 'target/tests/ComposeService-bootstrap.dual',
            password,
            reset: false,
            assembly: Assembly.dual,
            preset: Preset.bootstrap,
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-dual.yml');
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
            target: 'target/tests/ComposeService-bootstrap.repeat',
            password,
            preset: Preset.bootstrap,
            assembly: Assembly.multinode,
            customPreset: './test/repeat_preset.yml',
        };
        await assertDockerCompose(params, 'expected-docker-compose-bootstrap-repeat.yml');
    });

    it('resolveDebugOptions', async () => {
        const service = new ComposeService(logger, ComposeService.defaultParams);
        expect(service.resolveDebugOptions(true, true)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(true, undefined)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(true, false)).deep.equals({});
        expect(service.resolveDebugOptions(false, true)).deep.equals(ComposeService.DEBUG_SERVICE_PARAMS);
        expect(service.resolveDebugOptions(false, undefined)).deep.equals({});
        expect(service.resolveDebugOptions(false, false)).deep.equals({});
    });
});
