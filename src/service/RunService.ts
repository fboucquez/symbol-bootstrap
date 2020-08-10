import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { spawn } from 'child_process';
import { sep } from 'path';
import { RepositoryFactoryHttp } from 'symbol-sdk';
import { NodeStatusEnum } from 'symbol-openapi-typescript-fetch-client';
import { sleep } from './sleep';

type RunParams = { target: string; root: string; daemon?: boolean; build?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class RunService {
    constructor(protected readonly params: RunParams) {}

    public async run(): Promise<void> {
        const basicArgs = ['up', '--remove-orphans'];
        if (this.params.daemon) {
            basicArgs.push('--detach');
        }
        if (this.params.build) {
            basicArgs.push('--build');
        }
        await this.basicRun(basicArgs);
        if (this.params.daemon) {
            await this.pollServiceUntilIsUp();
        }
    }

    promisePoll = (promiseFunction: () => Promise<boolean>, totalPollingTime: number, pollIntervalMs: number): Promise<boolean> => {
        const startTime = new Date().getMilliseconds();
        return promiseFunction().then(async (result) => {
            if (result) {
                return true;
            } else {
                const endTime = new Date().getMilliseconds();
                const newPollingTime: number = Math.max(totalPollingTime - pollIntervalMs - (endTime - startTime), 0);
                if (newPollingTime) {
                    await sleep(pollIntervalMs);
                    return this.promisePoll(promiseFunction, newPollingTime, pollIntervalMs);
                } else {
                    return false;
                }
            }
        });
    };

    public async pollServiceUntilIsUp(totalPollingTime = 30000, pollIntervalMs = 2000) {
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

        const started = await this.promisePoll(pollFunction, totalPollingTime, pollIntervalMs);
        if (!started) {
            throw new Error(`Network did NOT start!!!`);
        }
    }

    public async stop(): Promise<void> {
        await this.basicRun(['down']);
    }

    private async basicRun(extraArgs: string[]): Promise<void> {
        const target = `${this.params.target}`;
        const dockerFile = `${target}${sep}docker${sep}docker-compose.yml`;
        const dockerComposeArgs = ['-f', dockerFile];

        const cmd = spawn('docker-compose', [...dockerComposeArgs, ...extraArgs]);

        const log = (data: any) => {
            if (!this.params.daemon) console.log(`${data}`.trim());
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

        logger.info(`running: docker-compose ${dockerComposeArgs.join(' ')}`);
    }
}
