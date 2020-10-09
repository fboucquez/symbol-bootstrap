import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { join } from 'path';
import { RepositoryFactoryHttp } from 'symbol-sdk';
import { NodeStatusEnum } from 'symbol-openapi-typescript-fetch-client';
import { BootstrapUtils } from './BootstrapUtils';
import { existsSync } from 'fs';
import { DockerCompose, DockerComposeService } from '../model/DockerCompose';
import * as _ from 'lodash';
import { PortService } from './PortService';

/**
 * params necessary to run the docker-compose network.
 */
export type RunParams = {
    target: string;
    detached?: boolean;
    healthCheck?: boolean;
    build?: boolean;
    timeout?: number;
    args?: string[];
    resetData?: boolean;
};

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class RunService {
    public static readonly defaultParams: RunParams = {
        target: BootstrapUtils.defaultTargetFolder,
        timeout: 60000,
        resetData: false,
    };

    constructor(protected readonly params: RunParams) {}

    public async run(): Promise<void> {
        if (this.params.resetData) {
            await this.resetData();
        }
        const basicArgs = ['up', '--remove-orphans'];
        if (this.params.detached) {
            basicArgs.push('--detach');
        }
        if (this.params.build) {
            basicArgs.push('--build');
        }
        if (this.params.args) {
            basicArgs.push(..._.flatMap(this.params.args, (s) => s.split(' ').map((internal) => internal.trim())));
        }

        const promises: Promise<any>[] = [];
        promises.push(this.basicRun(basicArgs, false));
        if (this.params.healthCheck) {
            await BootstrapUtils.sleep(5000);
            promises.push(this.healthCheck());
        }
        await Promise.all(promises);
    }

    public async healthCheck(pollIntervalMs = 10000): Promise<void> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        if (!existsSync(dockerFile)) {
            logger.info(`Docker compose ${dockerFile} does not exist. Cannot check the status of the service.`);
            return;
        }
        const dockerCompose: DockerCompose = BootstrapUtils.fromYaml(await BootstrapUtils.readTextFile(dockerFile));
        const services = Object.values(dockerCompose.services);

        const timeout = this.params.timeout || RunService.defaultParams.timeout || 0;
        const started = await BootstrapUtils.poll(() => this.runOneCheck(services), timeout, pollIntervalMs);
        if (!started) {
            throw new Error(`Network did NOT start!!!`);
        } else {
            logger.info('Network is running!');
        }
    }

    private async runOneCheck(services: DockerComposeService[]): Promise<boolean> {
        const runningContainers = (await BootstrapUtils.exec('docker ps --format {{.Names}}')).stdout.split(`\n`);
        const allServicesChecks: Promise<boolean>[] = services.map(async (service) => {
            if (runningContainers.indexOf(service.container_name) < 0) {
                logger.warn(`Container ${service.container_name} is NOT running YET.`);
                return false;
            }
            logger.info(`Container ${service.container_name} is running`);
            return (
                await Promise.all(
                    (service.ports || []).map(async (portBind) => {
                        const ports = portBind.split(':');
                        const externalPort = parseInt(ports[0]);
                        const internalPort = ports.length > 1 ? parseInt(ports[1]) : externalPort;
                        const portOpen = await PortService.isReachable(externalPort, 'localhost');
                        if (portOpen) {
                            logger.info(`Container ${service.container_name} port ${externalPort} -> ${internalPort} is open`);
                        } else {
                            logger.warn(`Container ${service.container_name} port ${externalPort} -> ${internalPort}  is NOT open YET.`);
                            return false;
                        }
                        if (internalPort == 3000) {
                            const url = 'http://localhost:' + externalPort;
                            const repositoryFactory = new RepositoryFactoryHttp(url);
                            const nodeRepository = repositoryFactory.createNodeRepository();
                            const testUrl = `${url}/node/health`;
                            logger.info(`Testing ${testUrl}`);
                            try {
                                const healthStatus = await nodeRepository.getNodeHealth().toPromise();
                                if (healthStatus.apiNode === NodeStatusEnum.Down) {
                                    logger.warn(`Rest ${testUrl} is NOT up and running YET: Api Node is still Down!`);
                                    return false;
                                }
                                if (healthStatus.db === NodeStatusEnum.Down) {
                                    logger.warn(`Rest ${testUrl} is NOT up and running YET: DB is still Down!`);
                                    return false;
                                }
                                logger.info(`Rest ${testUrl} is up and running...`);
                                return true;
                            } catch (e) {
                                logger.warn(`Rest ${testUrl} is NOT up and running YET: ${e.message}`);
                                return false;
                            }
                        }
                        return true;
                    }),
                )
            ).every((t) => t);
        });
        return (await Promise.all(allServicesChecks)).every((t) => t);
    }

    public async resetData(): Promise<void> {
        logger.info('Resetting data');
        const target = this.params.target;
        const preset = BootstrapUtils.loadExistingPresetData(target);
        const nemesisSeedFolder = BootstrapUtils.getTargetNemesisFolder(target, false, 'seed');
        await Promise.all(
            (preset.nodes || []).map(async (node) => {
                const componentConfigFolder = BootstrapUtils.getTargetNodesFolder(target, false, node.name);
                const dataFolder = join(componentConfigFolder, 'data');
                BootstrapUtils.deleteFolder(join(componentConfigFolder, 'data'), ['private_key_tree1.dat']);
                BootstrapUtils.deleteFolder(join(componentConfigFolder, 'logs'));
                logger.info(`Copying block 1 seed to ${dataFolder}`);
                await BootstrapUtils.generateConfiguration({}, nemesisSeedFolder, dataFolder);
            }),
        );
        (preset.gateways || []).forEach((node) => {
            BootstrapUtils.deleteFolder(BootstrapUtils.getTargetGatewayFolder(target, false, node.name, 'logs'));
        });
        BootstrapUtils.deleteFolder(BootstrapUtils.getTargetDatabasesFolder(target, false));
    }

    public async stop(): Promise<void> {
        await this.basicRun(['down'], true);
    }

    private async basicRun(extraArgs: string[], ignoreIfNotFound: boolean): Promise<string> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        if (!existsSync(dockerFile)) {
            if (ignoreIfNotFound) {
                logger.info(`Docker compose ${dockerFile} does not exist, ignoring: docker-compose ${args.join(' ')}`);
                return '';
            } else {
                throw new Error(`Docker compose ${dockerFile} does not exist. Cannot run: docker-compose ${args.join(' ')}`);
            }
        }

        //Creating folders to avoid being created using sudo. Is there a better way?
        const dockerCompose: DockerCompose = await BootstrapUtils.loadYaml(dockerFile);
        if (!ignoreIfNotFound) await this.pullImages(dockerCompose);

        const volumenList = _.flatMap(Object.values(dockerCompose?.services), (s) => s.volumes?.map((v) => v.split(':')[0]) || []) || [];

        await Promise.all(
            volumenList.map(async (v) => {
                const volumenPath = join(this.params.target, `docker`, v);
                if (!existsSync(volumenPath)) await BootstrapUtils.mkdir(volumenPath);
            }),
        );
        return BootstrapUtils.spawn('docker-compose', args, false);
    }

    private async pullImages(dockerCompose: DockerCompose) {
        const images = _.uniq(
            Object.values(dockerCompose.services)
                .map((s) => s.image)
                .filter((s) => s)
                .map((s) => s as string),
        );
        await Promise.all(images.map(async (image) => await BootstrapUtils.pullImage(image)));
    }
}
