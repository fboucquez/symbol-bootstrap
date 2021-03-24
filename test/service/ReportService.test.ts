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
import { BootstrapUtils, ConfigParams, ConfigService, Preset, ReportService } from '../../src/service';

describe('ReportService', () => {
    const assertReport = async (params: ConfigParams, expectedReportsFolder: string): Promise<void> => {
        const configResult = await new ConfigService('.', params).run();

        const paths = await new ReportService('.', params).run(configResult.presetData);
        const expectedReportFolder = `./test/reports/${expectedReportsFolder}`;
        await BootstrapUtils.mkdir(expectedReportFolder);

        const promises = paths.map(async (reportPath) => {
            expect(reportPath.indexOf(`${params.target}/report`)).to.be.greaterThan(-1);
            const generatedReport = (await BootstrapUtils.readTextFile(reportPath)).replace(BootstrapUtils.VERSION, 'CURRENT_VERSION');
            const expectedReportPath = join(expectedReportFolder, reportPath.replace(/^.*[\\\/]/, ''));
            if (!existsSync(expectedReportPath)) {
                await BootstrapUtils.writeTextFile(expectedReportPath, generatedReport.trim());
            }
            const expectedReport = await BootstrapUtils.readTextFile(expectedReportPath);
            expect(
                generatedReport.trim(),
                `Report ${reportPath} doesn't match

`,
            ).to.be.eq(expectedReport.trim());
        });
        await Promise.all(promises);
    };

    it('ReportService testnet dual voting report', async () => {
        const target = 'target/tests/ReportService.testnet.voting.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: true,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: customPresetObject,
            assembly: 'dual',
            target: target,
            report: true,
        };

        await assertReport(params, 'testnet-dual-voting');
    });

    it('ReportService testnet peer voting report', async () => {
        const target = 'target/tests/ReportService.testnet.peer.voting.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: true,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: customPresetObject,
            assembly: 'peer',
            target: target,
            report: true,
        };

        await assertReport(params, 'testnet-peer-voting');
    });

    it('ReportService testnet peer voting non harvesting report', async () => {
        const target = 'target/tests/ReportService.testnet.peer.non.harvesting.voting.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: true,
                    harvesting: false,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: customPresetObject,
            assembly: 'peer',
            target: target,
            report: true,
        };

        await assertReport(params, 'testnet-peer-non-harvesting-voting');
    });

    it('ReportService testnet api', async () => {
        const target = 'target/tests/ReportService.testnet.api.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: false,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: customPresetObject,
            assembly: 'api',
            target: target,
            report: true,
        };

        await assertReport(params, 'testnet-api');
    });

    it('ReportService mainnet peer', async () => {
        const target = 'target/tests/ReportService.mainnet.peer.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: false,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.mainnet,
            customPresetObject: customPresetObject,
            assembly: 'peer',
            target: target,
            report: true,
        };

        await assertReport(params, 'mainnet-peer');
    });

    it('ReportService mainnet dual', async () => {
        const target = 'target/tests/ReportService.mainnet.dual.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: false,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.mainnet,
            customPresetObject: customPresetObject,
            assembly: 'dual',
            target: target,
            report: true,
        };

        await assertReport(params, 'mainnet-dual');
    });

    it('ReportService mainnet dual voting', async () => {
        const target = 'target/tests/ReportService.mainnet.dual.voting.report';
        const customPresetObject = {
            nodes: [
                {
                    mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
                    voting: true,
                    friendlyName: 'myFriendlyName',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.mainnet,
            customPresetObject: customPresetObject,
            assembly: 'dual',
            target: target,
            report: true,
        };

        await assertReport(params, 'mainnet-dual-voting');
    });

    it('ReportService bootstrap report', async () => {
        const target = 'target/tests/ReportService.bootstrap.voting.report';
        const customPresetObject = {
            nemesisGenerationHashSeed: '6AF8E35BBC7AC341E7931B39E2C9A591EDBE9F9111996053E6771D48E9C53B31',
            nemesis: {
                nemesisSignerPrivateKey: 'AA0863BDB0C2C275EE8CADECC8FAF01CAF632A2D6E1DE9ECB58917F65C89B204',
            },
            harvestNetworkFeeSinkAddress: 'TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q',
            mosaicRentalFeeSinkAddress: 'TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q',
            namespaceRentalFeeSinkAddress: 'TDGY4DD2U4YQQGERFMDQYHPYS6M7LHIF6XUCJ4Q',
            nodes: [
                {
                    voting: true,
                    friendlyName: 'my-peer-node-{{$index}}',
                },
                {
                    friendlyName: 'my-api-node-{{$index}}',
                },
            ],
        };
        const params = {
            ...ConfigService.defaultParams,
            reset: false,
            preset: Preset.bootstrap,
            customPresetObject: customPresetObject,
            target: target,
            report: true,
        };

        await assertReport(params, 'bootstrap-voting');
    });
});
