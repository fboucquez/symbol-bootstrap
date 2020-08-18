import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';
import { existsSync } from 'fs';
import { ConfigPreset } from '../model/ConfigPreset';

type MongoParams = { target: string; reset: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class MongoService {
    constructor(private readonly root: string, protected readonly params: MongoParams) {}

    public async run(): Promise<void> {
        const presetData = BootstrapUtils.loadExistingPresetData(this.params.target);
        const dir = `${process.cwd()}/${this.params.target}`;
        const mongoDbDir = `${dir}/data/mongo`;
        if (this.params.reset && existsSync(mongoDbDir)) {
            logger.info('Resetting mongo db');
            BootstrapUtils.deleteFolder(mongoDbDir);
        }

        await BootstrapUtils.mkdir(`${this.params.target}/data/nemesis-data`);
        await BootstrapUtils.mkdir(`${this.params.target}/data/mongo`);
        await BootstrapUtils.mkdir(`${this.params.target}/state`);

        const docker = BootstrapUtils.createDocker();
        const cmd = ['bash', '-c', 'mongod --dbpath=/dbdata --bind_ip=db'];
        logger.info('Running mongo');

        const binds = [`${mongoDbDir}:/dbdata:rw`];
        const createOptions = {
            Hostname: 'db',
            HostConfig: {
                Binds: binds,
                PortBindings: { '27017/tcp': [{ HostPort: '27017' }] },
                AutoRemove: true,
                NetworkMode: 'symbol-network',
            },
        };
        const startOptions = {};
        docker.run(presetData.mongoImage, cmd, process.stdout, createOptions, startOptions);
        await BootstrapUtils.sleep(1000);
        await this.initDb(presetData);
    }

    public async initDb(presetData: ConfigPreset): Promise<void> {
        const workingDir = `${process.cwd()}`;
        const target = `${workingDir}/${this.params.target}`;
        if (this.params.reset && existsSync(target)) {
            logger.info('Resetting mongo db');
            BootstrapUtils.deleteFolder(target);
        }
        const docker = BootstrapUtils.createDocker();
        const cmd = [
            'bash',
            '-c',
            'apt-get install -y iputils-ping && ls -la /userconfig && ping db && /bin/bash /userconfig/mongors.sh && touch /state/mongo-is-setup && touch /state/mongo-is-setup',
        ];

        logger.info('Initializing mongo');
        logger.info(`${this.root}/config/docker/mongo`);
        const binds = [`${target}/data/mongo:/dbdata:rw`, `${target}/state:/state`, `${this.root}/config/docker/mongo/:/userconfig/:ro`];
        const createOptions = { HostConfig: { Binds: binds, AutoRemove: true, NetworkMode: 'symbol-network' } };
        const startOptions = {};
        await docker.run(presetData.mongoImage, cmd, process.stdout, createOptions, startOptions);
    }
}
