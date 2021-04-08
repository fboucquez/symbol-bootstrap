/*
 * Copyright 2021 NEM
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
import * as os from 'os';
import { BootstrapUtils } from '../../src/service';
import { VerifyService } from '../../src/service/VerifyService';

describe('VerifyService', () => {
    it('VerifyService verify current installation', async () => {
        const service = new VerifyService();
        const report = await service.createReport();
        const expected = {
            lines: [
                {
                    header: 'NodeVersion',
                    message: process.versions.node,
                },
                {
                    header: 'Docker Version',
                    message: '19.3.8',
                },
                {
                    header: 'Docker Compose Version',
                    message: '1.25.0',
                },
                {
                    header: 'Docker Run Test',
                    message: "Command 'docker run hello-world' executed!",
                },
                {
                    header: 'Sudo User Test',
                    message: 'Your are not the sudo user!',
                },
            ],
            platform: `${os.type()} - ${os.release()} - ${os.platform()}`,
        };
        expect(report).to.be.deep.eq(expected);
    });

    it('VerifyService verify current installation when too old', async () => {
        const expectedVersions = {
            node: '18.0.0',
            docker: '19.4.0',
            dockerCompose: '1.25.30',
        };
        const service = new VerifyService(BootstrapUtils.resolveRootFolder(), expectedVersions);
        const report = await service.createReport();
        const expected = {
            lines: [
                {
                    header: 'NodeVersion',
                    message: process.versions.node,
                    recommendation: `At least version ${expectedVersions.node} is required. Currently installed version is 12.16.3. Check https://nodejs.org/en/download/package-manager/`,
                },
                {
                    header: 'Docker Version',
                    message: '19.3.8',
                    recommendation: `At least version ${expectedVersions.docker} is required. Currently installed version is 19.3.8. Check https://docs.docker.com/get-docker/`,
                },
                {
                    header: 'Docker Compose Version',
                    message: '1.25.0',
                    recommendation: `At least version ${expectedVersions.dockerCompose} is required. Currently installed version is 1.25.0. Check https://docs.docker.com/compose/install/`,
                },
                {
                    header: 'Sudo User Test',
                    message: 'Your are not the sudo user!',
                },
            ],
            platform: `${os.type()} - ${os.release()} - ${os.platform()}`,
        };
        expect(report).to.be.deep.eq(expected);
    });
});
