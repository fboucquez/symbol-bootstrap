import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';
import { promises } from 'fs';

import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';
import { join } from 'path';

type NemgenParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetConfigFolder = BootstrapUtils.targetConfigFolder;

export class NemgenService {
    constructor(private readonly root: string, protected readonly params: NemgenParams) {}

    public async run(presetData: ConfigPreset): Promise<void> {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerToolsImage = presetData.symbolServerToolsImage;
        const nemesisFolder = join(`${this.params.target}`, targetConfigFolder, 'nemesis');
        const nemesisSeedFolder = join(nemesisFolder, `seed`, `${networkIdentifier}`, `0000`);
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(join(this.root, `config`, `hashes.dat`), join(nemesisSeedFolder, `hashes.dat`));
        const workingDirFullPath = `${process.cwd()}/${this.params.target}/${targetConfigFolder}`;

        const cmd = [
            'bash',
            '-c',
            'cd /nemesis && /usr/catapult/bin/catapult.tools.nemgen  -r /userconfig --nemesisProperties ./userconfig/block-properties-file.properties',
        ];

        if (!presetData.nodes) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }

        const binds = [
            `${workingDirFullPath}/${presetData.nodes[0].name}/userconfig:/userconfig`,
            `${workingDirFullPath}/nemesis:/nemesis`,
        ];

        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec(symbolServerToolsImage, userId, cmd, binds);

        if (stdout.indexOf('<error>') > -1) {
            logger.info(stdout);
            logger.error(stderr);
            throw new Error('Nemgen failed. Check the logs!');
        }
        logger.info('Nemgen executed!!!!');
    }
}
