import 'mocha';
import { BootstrapUtils, ConfigParams, ConfigService, Preset } from '../../src/service';
import { ReportService } from '../../src/service/ReportService';
import { expect } from '@oclif/test';
import { readdirSync } from 'fs';
import { join } from 'path';

describe('ReportService', () => {
    const assertReport = async (params: ConfigParams, expectedReportsFolder: string): Promise<void> => {
        const configResult = await new ConfigService('.', params).run();

        const paths = await new ReportService('.', params).run(configResult.presetData);
        const expectedReportFolder = `./test/reports/${expectedReportsFolder}`;
        expect(paths.length).to.eq(readdirSync(expectedReportFolder).length);

        const promises = paths.map(async (reportPath) => {
            expect(reportPath.indexOf(`${params.target}/report`)).to.be.greaterThan(-1);
            const generatedReport = await BootstrapUtils.readTextFile(reportPath);
            const expectedReport = await BootstrapUtils.readTextFile(join(expectedReportFolder, reportPath.replace(/^.*[\\\/]/, '')));
            expect(
                generatedReport.trim(),
                `Report ${reportPath} doesn't match

`,
            ).to.be.eq(expectedReport.trim());
        });

        await Promise.all(promises);
    };

    it('ReportService testnet dual voting report', async () => {
        const target = 'target/ReportService.testnet.voting.report';
        const customPresetObject = {
            nodes: [
                {
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
        const target = 'target/ReportService.testnet.peer.report';
        const customPresetObject = {
            nodes: [
                {
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

        await assertReport(params, 'testnet-peer');
    });

    it('ReportService bootstrap report', async () => {
        const target = 'target/ReportService.bootstrap.voting.report';
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
