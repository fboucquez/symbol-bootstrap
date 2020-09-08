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

export class NemgenService {
    constructor(private readonly root: string, protected readonly params: NemgenParams) {}

    public async run(presetData: ConfigPreset): Promise<void> {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerToolsImage = presetData.symbolServerToolsImage;
        const target = this.params.target;

        if (!presetData.nodes || !presetData.nodes.length) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }

        const nemesisWorkingDir = BootstrapUtils.getTargetNemesisFolder(target, true);
        const nemesisSeedFolder = join(nemesisWorkingDir, `seed`, `${networkIdentifier}`, `0000`);
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(join(this.root, `config`, `hashes.dat`), join(nemesisSeedFolder, `hashes.dat`));
        const name = presetData.nodes[0].name;
        const userConfigWorkingDir = BootstrapUtils.getTargetNodesFolder(target, true, name, 'userconfig');

        BootstrapUtils.validateFolder(nemesisWorkingDir);
        BootstrapUtils.validateFolder(userConfigWorkingDir);

        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.nemgen`,
            '--resources=/userconfig',
            '--nemesisProperties=./userconfig/block-properties-file.properties',
        ];

        const binds = [`${userConfigWorkingDir}:/userconfig`, `${nemesisWorkingDir}:/nemesis`];

        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
            catapultAppFolder: presetData.catapultAppFolder,
            image: symbolServerToolsImage,
            userId: userId,
            workdir: '/nemesis',
            cmds: cmd,
            binds: binds,
        });

        if (stdout.indexOf('<error>') > -1) {
            logger.info(stdout);
            logger.error(stderr);
            throw new Error('Nemgen failed. Check the logs!');
        }
        logger.info('Nemgen executed!!!!');
    }
}
