import 'mocha';
import { BootstrapUtils, ConfigService, Preset } from '../../src/service';
import { ReportService } from '../../src/service/ReportService';
import { expect } from '@oclif/test';

describe('ReportService', () => {
    it('ReportService testnet report', async () => {
        const target = 'target/ReportService.testnet.report';
        const customPresetObject = {
            nodes: [
                {
                    voting: true,
                    roles: 'Api,Peer,Voting',
                    friendlyName: 'myFriendlyName',
                    signingPrivateKey: '19CBD6AE842F9FDDC8F6F2AE8081981CF2268435BACA6A8A6A91740D631494BD',
                    vrfPrivateKey: '620857FB100B5F34379DAD160C9A43D6B1BDC562D83DC37A468DD99D31C830F6',
                },
            ],
        };
        const configResult = await new ConfigService('.', {
            ...ConfigService.defaultParams,
            reset: true,
            preset: Preset.testnet,
            customPresetObject: customPresetObject,
            assembly: 'dual',
            target: target,
            report: true,
        }).run();

        const paths = await new ReportService('.', { target }).run(configResult.presetData);
        expect(paths.length).to.eq(1);
        const reportPath = paths[0];
        expect(reportPath).to.eq('target/ReportService.testnet.report/report/api-node-config.rst');

        const generatedReport = await BootstrapUtils.readTextFile(reportPath);
        const expectedReport = await BootstrapUtils.readTextFile('./test/expected-api-node-config.rst');
        expect(generatedReport.trim()).to.be.eq(expectedReport.trim());
    });
});
