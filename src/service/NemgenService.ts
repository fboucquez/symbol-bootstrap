import { ConfigParams } from './ConfigService';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';
import { promises } from 'fs';
import * as Docker from 'dockerode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MemoryStream = require('memorystream');
import { BootstrapUtils } from './BootstrapUtils';
type NemgenParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class NemgenService {
    constructor(protected readonly params: NemgenParams) {}

    public async run(networkIdentifier: string, symbolServerToolsImage: string): Promise<void> {
        const docker = new Docker({ socketPath: '/var/run/docker.sock' });
        await BootstrapUtils.pullImage(docker, symbolServerToolsImage);

        const nemesisSeedFolder = `${this.params.target}/data/nemesis-data/seed/${networkIdentifier}/0000`;
        await BootstrapUtils.mkdir(nemesisSeedFolder);
        await promises.copyFile(`${this.params.root}/config/hashes.dat`, `${nemesisSeedFolder}/hashes.dat`);

        const cmd = [
            'bash',
            '-c',
            'cd /data && /usr/catapult/bin/catapult.tools.nemgen  -r /userconfig --nemesisProperties /nemesis/block-properties-file.properties',
        ];

        const dir = `${process.cwd()}/${this.params.target}`;
        const binds = [
            `${dir}/config/generated-addresses:/addresses`,
            `${dir}/config/peer-node-0:/userconfig`,
            `${dir}/config/nemesis:/nemesis`,
            `${dir}/data/nemesis-data:/data:rw`,
        ];
        const createOptions = { User: await BootstrapUtils.getDockerUserGroup(), HostConfig: { Binds: binds } };
        const startOptions = {};

        const memStream = new MemoryStream();
        let stdout = '';
        memStream.on('data', (data: any) => {
            const string = data.toString();
            // process.stdout.write(string);
            stdout += string;
        });
        logger.info('Running nemgen...');
        await docker.run(symbolServerToolsImage, cmd, memStream, createOptions, startOptions);
        if (stdout.indexOf('<error> ') > -1) {
            logger.info(stdout);
            throw new Error('Nemgen failed. Check the logs!');
        }
        logger.info('Nemgen executed!!!!');
    }
}
