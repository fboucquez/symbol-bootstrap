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
import * as os from 'os';
import * as semver from 'semver';
import { AppVersionService, LoggerFactory, LogType, OSUtils, RuntimeService, VerifyReport } from '../../src';
import { VerifyService } from '../../src/service';
const logger = LoggerFactory.getLogger(LogType.Silent);
const runtimeService = new RuntimeService(logger);

describe('AppVersionService', () => {
    it('loadVersion', async () => {
        const service = new AppVersionService(logger, runtimeService);
        expect(service.loadVersion('Docker version 19.03.8, build afacb8b7f0')).eq('19.03.8');
        expect(service.loadVersion('Docker version 19.0.8, build afacb8b7f0')).eq('19.0.8');
        expect(service.loadVersion('Docker version 19 build a')).eq('19.0.0');
    });
});

describe('VerifyService', () => {
    const currentNodeJsVersion = VerifyService.currentNodeJsVersion;
    async function getCurrentVersions() {
        const appVersionService = new AppVersionService(logger, runtimeService);
        const currentDockerVersion = await appVersionService.loadVersionFromCommand('docker --version');
        const currentDockerComposeVersion = await appVersionService.loadVersionFromCommand('docker-compose --version');
        expect(semver.valid(VerifyService.currentNodeJsVersion, AppVersionService.semverOptions));
        expect(semver.valid(currentDockerVersion, AppVersionService.semverOptions));
        expect(semver.valid(currentDockerComposeVersion, AppVersionService.semverOptions));
        return { currentDockerVersion, currentDockerComposeVersion };
    }

    it('VerifyService verify current installation', async () => {
        const service = new VerifyService(logger);
        const { currentDockerVersion, currentDockerComposeVersion } = await getCurrentVersions();
        expect(currentDockerVersion).not.undefined;
        expect(currentDockerComposeVersion).not.undefined;
        const report = await service.createReport();
        const expected: VerifyReport = {
            lines: [
                {
                    header: 'NodeVersion',
                    message: currentNodeJsVersion,
                },
                {
                    header: 'Docker Version',
                    message: currentDockerVersion!,
                },
                {
                    header: 'Docker Compose Version',
                    message: currentDockerComposeVersion!,
                },
                {
                    header: 'Docker Run Test',
                    message: "Command 'docker run hello-world' executed!",
                },
            ],
            platform: `${os.type()} - ${os.release()} - ${os.platform()}`,
        };
        if (!OSUtils.isWindows()) {
            expected.lines.push({
                header: 'Sudo User Test',
                message: 'Your are not the sudo user!',
            });
        }
        expect(report).to.be.deep.eq(expected);
        service.logReport(report);
        expect(() => service.validateReport(report)).not.to.throw();
    });

    it('VerifyService verify current installation when too old', async () => {
        const expectedVersions = {
            node: '18.0.0',
            docker: '21.4.0',
            dockerCompose: '1.29.5',
        };
        const service = new VerifyService(logger, expectedVersions);
        const { currentDockerVersion, currentDockerComposeVersion } = await getCurrentVersions();
        expect(currentDockerVersion).not.undefined;
        expect(currentDockerComposeVersion).not.undefined;
        const report = await service.createReport();
        const expected: VerifyReport = {
            lines: [
                {
                    header: 'NodeVersion',
                    message: currentNodeJsVersion,
                    recommendation: `At least version ${expectedVersions.node} is required. Currently installed version is ${currentNodeJsVersion}. Check https://nodejs.org/en/download/package-manager/`,
                },
                {
                    header: 'Docker Version',
                    message: currentDockerVersion!,
                    recommendation: `At least version ${expectedVersions.docker} is required. Currently installed version is ${currentDockerVersion}. Check https://docs.docker.com/get-docker/`,
                },
                {
                    header: 'Docker Compose Version',
                    message: currentDockerComposeVersion!,
                    recommendation: `At least version ${expectedVersions.dockerCompose} is required. Currently installed version is ${currentDockerComposeVersion}. Check https://docs.docker.com/compose/install/`,
                },
            ],
            platform: `${os.type()} - ${os.release()} - ${os.platform()}`,
        };
        if (!OSUtils.isWindows()) {
            expected.lines.push({
                header: 'Sudo User Test',
                message: 'Your are not the sudo user!',
            });
        }
        expect(report).to.be.deep.eq(expected);
        service.logReport(report);
        expect(() => service.validateReport(report)).to.throw(
            `There has been an error. Check the report:
 - NodeVersion  - Error! - ${currentNodeJsVersion} - At least version ${expectedVersions.node} is required. Currently installed version is ${currentNodeJsVersion}. Check https://nodejs.org/en/download/package-manager/
 - Docker Version  - Error! - ${currentDockerVersion} - At least version ${expectedVersions.docker} is required. Currently installed version is ${currentDockerVersion}. Check https://docs.docker.com/get-docker/
 - Docker Compose Version  - Error! - ${currentDockerComposeVersion} - At least version ${expectedVersions.dockerCompose} is required. Currently installed version is ${currentDockerComposeVersion}. Check https://docs.docker.com/compose/install/`,
        );
    });
});
