import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';
import { promises } from 'fs';

import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';

type NemgenParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class NemgenService {
    constructor(private readonly root: string, protected readonly params: NemgenParams) {}

    public async run(presetData: ConfigPreset): Promise<void> {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerToolsImage = presetData.symbolServerToolsImage;

        const nemesisSeedFolder = `${this.params.target}/data/nemesis-data/seed/${networkIdentifier}/0000`;
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(`${this.root}/config/hashes.dat`, `${nemesisSeedFolder}/hashes.dat`);

        const cmd = [
            'bash',
            '-c',
            'cd /data && /usr/catapult/bin/catapult.tools.nemgen  -r /userconfig --nemesisProperties /nemesis/block-properties-file.properties',
        ];

        if (!presetData.nodes) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }

        const dir = `${process.cwd()}/${this.params.target}`;
        const binds = [
            `${dir}/config/generated-addresses:/addresses`,
            `${dir}/config/${presetData.nodes[0].name}:/userconfig`,
            `${dir}/config/nemesis:/nemesis`,
            `${dir}/data/nemesis-data:/data:rw`,
        ];

        const stdout = await BootstrapUtils.runImageUsingExec(
            symbolServerToolsImage,
            await BootstrapUtils.getDockerUserGroup(),
            cmd,
            binds,
        );

        if (stdout.indexOf('<error> ') > -1) {
            logger.info(stdout);
            throw new Error('Nemgen failed. Check the logs!');
        }
        await BootstrapUtils.deleteFolder(`${dir}/data/nemesis-data/statedb`);
        logger.info('Nemgen executed!!!!');
    }
}
