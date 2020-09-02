import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { spawn } from 'child_process';
import { join } from 'path';
import { RepositoryFactoryHttp } from 'symbol-sdk';
import { NodeStatusEnum } from 'symbol-openapi-typescript-fetch-client';
import { BootstrapUtils } from './BootstrapUtils';
import { existsSync } from 'fs';
import { DockerCompose } from '../model/DockerCompose';
import * as _ from 'lodash';

/**
 * params necessary to run the docker-compose network.
 */
export type RunParams = { target: string; daemon?: boolean; build?: boolean; timeout?: number };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class RunService {
    public static readonly defaultParams: RunParams = { target: 'target', timeout: 60000 };

    constructor(protected readonly params: RunParams) {}

    public async run(): Promise<void> {
        const basicArgs = ['up', '--remove-orphans'];
        if (this.params.daemon) {
            basicArgs.push('--detach');
        }
        if (this.params.build) {
            basicArgs.push('--build');
        }
        await this.basicRun(basicArgs, false);
        if (this.params.daemon) {
            await this.pollServiceUntilIsUp(this.params.timeout || RunService.defaultParams.timeout || 0);
        }
    }

    public async pollServiceUntilIsUp(totalPollingTime: number, pollIntervalMs = 10000): Promise<void> {
        const url = 'http://localhost:3000';
        const repositoryFactory = new RepositoryFactoryHttp(url);
        const nodeRepository = repositoryFactory.createNodeRepository();
        const pollFunction = async () => {
            logger.info(`Testing ${url}/node/health`);
            try {
                const healthStatus = await nodeRepository.getNodeHealth().toPromise();
                if (healthStatus.apiNode === NodeStatusEnum.Down) {
                    logger.warn(`Network is NOT up and running YET: Api Node is still Down!`);
                    return false;
                }
                if (healthStatus.db === NodeStatusEnum.Down) {
                    logger.warn(`Network is NOT up and running YET: DB is still Down!`);
                    return false;
                }
                logger.info(`Network IS up and running...`);
                return true;
            } catch (e) {
                logger.warn(`Network is NOT up and running YET: ${e.message}`);
                return false;
            }
        };

        const started = await BootstrapUtils.poll(pollFunction, totalPollingTime, pollIntervalMs);
        if (!started) {
            throw new Error(`Network did NOT start!!!`);
        }
    }

    public async stop(): Promise<void> {
        await this.basicRun(['down'], true);
    }

    private async basicRun(extraArgs: string[], ignoreIfNotFound: boolean): Promise<void> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        if (!existsSync(dockerFile)) {
            if (ignoreIfNotFound) {
                logger.info(`Docker compose ${dockerFile} does not exist, ignoring: docker-compose ${args.join(' ')}`);
                return;
            } else {
                throw new Error(`Docker compose ${dockerFile} does not exist. Cannot run: docker-compose ${args.join(' ')}`);
            }
        }

        //Creating folders to avoid being created using sudo. Is there a better way?
        const dockerCompose: DockerCompose = await BootstrapUtils.loadYaml(dockerFile);

        const volumenList = _.flatMap(Object.values(dockerCompose?.services), (s) => s.volumes?.map((v) => v.split(':')[0]) || []) || [];

        await Promise.all(
            volumenList.map(async (v) => {
                await BootstrapUtils.mkdir(join(this.params.target, `docker`, v));
            }),
        );

        const cmd = spawn('docker-compose', args);

        const log = (data: any) => {
            console.log(`${data}`.trim());
        };

        cmd.stdout.on('data', (data) => {
            log(data);
        });

        cmd.stderr.on('data', (data) => {
            log(`${data}`.trim());
        });

        cmd.on('error', (error) => {
            log(`error: ${error.message}`.trim());
        });

        cmd.on('exit', (code, signal) => {
            log(`child process exited with code ${code} and signal ${signal}`);
        });

        cmd.on('close', (code) => {
            log(`child process exited with code ${code}`);
        });

        process.on('SIGINT', function () {
            log('Received SIGINT signal');
        });

        logger.info(`running: docker-compose ${args.join(' ')}`);
    }
}
