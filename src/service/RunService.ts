/*
 * Copyright 2020 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { chmodSync, existsSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import { NodeStatusEnum } from 'symbol-openapi-typescript-fetch-client';
import { RepositoryFactoryHttp } from 'symbol-sdk';
import { Logger } from '../logger';
import { DockerCompose, DockerComposeService } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';
import { OSUtils } from './OSUtils';
import { PortService } from './PortService';
import { RuntimeService } from './RuntimeService';
/**
 * params necessary to run the docker-compose network.
 */
export type RunParams = {
    detached?: boolean;
    healthCheck?: boolean;
    build?: boolean;
    pullImages?: boolean;
    timeout?: number;
    args?: string[];
    resetData?: boolean;
    target: string;
};

export class RunService {
    public static readonly defaultParams: RunParams = {
        target: BootstrapUtils.defaultTargetFolder,
        timeout: 60000,
        pullImages: false,
        resetData: false,
    };

    private readonly configLoader: ConfigLoader;
    private readonly runtimeService: RuntimeService;

    constructor(private readonly logger: Logger, protected readonly params: RunParams) {
        this.configLoader = new ConfigLoader(this.logger);
        this.runtimeService = new RuntimeService(this.logger);
    }

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

        await this.beforeRun(basicArgs, false);

        const promises: Promise<any>[] = [];
        promises.push(this.basicRun(basicArgs));
        if (this.params.healthCheck) {
            await BootstrapUtils.sleep(5000);
            promises.push(this.healthCheck());
        }
        await Promise.all(promises);
    }

    public async healthCheck(pollIntervalMs = 10000): Promise<void> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        if (!existsSync(dockerFile)) {
            this.logger.info(`Docker compose ${dockerFile} does not exist. Cannot check the status of the service.`);
            return;
        }
        const dockerCompose: DockerCompose = BootstrapUtils.fromYaml(await BootstrapUtils.readTextFile(dockerFile));
        const services = Object.values(dockerCompose.services);

        const timeout = this.params.timeout || RunService.defaultParams.timeout || 0;
        const started = await BootstrapUtils.poll(this.logger, () => this.runOneCheck(services), timeout, pollIntervalMs);
        if (!started) {
            throw new Error(`Network did NOT start!!!`);
        } else {
            this.logger.info('Network is running!');
        }
    }

    private async runOneCheck(services: DockerComposeService[]): Promise<boolean> {
        const runningContainers = (await this.runtimeService.exec('docker ps --format {{.Names}}')).stdout.split(`\n`);
        const allServicesChecks: Promise<boolean>[] = services.map(async (service) => {
            if (runningContainers.indexOf(service.container_name) < 0) {
                this.logger.warn(`Container ${service.container_name} is NOT running YET.`);
                return false;
            }
            this.logger.info(`Container ${service.container_name} is running`);
            return (
                await Promise.all(
                    (service.ports || []).map(async (portBind) => {
                        const ports = portBind.split(':');
                        const externalPort = parseInt(ports[0]);
                        const internalPort = ports.length > 1 ? parseInt(ports[1]) : externalPort;
                        const portOpen = await PortService.isReachable(externalPort, 'localhost');
                        if (portOpen) {
                            this.logger.info(`Container ${service.container_name} port ${externalPort} -> ${internalPort} is open`);
                        } else {
                            this.logger.warn(
                                `Container ${service.container_name} port ${externalPort} -> ${internalPort}  is NOT open YET.`,
                            );
                            return false;
                        }
                        if (service.container_name.indexOf('rest-gateway') > -1) {
                            const url = 'http://localhost:' + externalPort;
                            const repositoryFactory = new RepositoryFactoryHttp(url);
                            const nodeRepository = repositoryFactory.createNodeRepository();
                            const testUrl = `${url}/node/health`;
                            this.logger.info(`Testing ${testUrl}`);
                            try {
                                const healthStatus = await nodeRepository.getNodeHealth().toPromise();
                                if (healthStatus.apiNode === NodeStatusEnum.Down) {
                                    this.logger.warn(`Rest ${testUrl} is NOT up and running YET: Api Node is still Down!`);
                                    return false;
                                }
                                if (healthStatus.db === NodeStatusEnum.Down) {
                                    this.logger.warn(`Rest ${testUrl} is NOT up and running YET: DB is still Down!`);
                                    return false;
                                }
                                this.logger.info(`Rest ${testUrl} is up and running...`);
                                return true;
                            } catch (e) {
                                this.logger.warn(`Rest ${testUrl} is NOT up and running YET: ${e.message}`);
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
        this.logger.info('Resetting data');
        const target = this.params.target;
        const preset = this.configLoader.loadExistingPresetData(target, false);
        await Promise.all(
            (preset.nodes || []).map(async (node) => {
                const componentConfigFolder = BootstrapUtils.getTargetNodesFolder(target, false, node.name);
                const dataFolder = join(componentConfigFolder, 'data');
                const logsFolder = join(componentConfigFolder, 'logs');
                BootstrapUtils.deleteFolder(this.logger, dataFolder);
                BootstrapUtils.deleteFolder(this.logger, logsFolder);
                await BootstrapUtils.mkdir(dataFolder);
                await BootstrapUtils.mkdir(logsFolder);
            }),
        );
        (preset.gateways || []).forEach((node) => {
            BootstrapUtils.deleteFolder(this.logger, BootstrapUtils.getTargetGatewayFolder(target, false, node.name, 'logs'));
        });
        BootstrapUtils.deleteFolder(this.logger, BootstrapUtils.getTargetDatabasesFolder(target, false));
    }

    public async stop(): Promise<void> {
        const args = ['stop'];
        if (await this.beforeRun(args, true)) await this.basicRun(args);
    }

    private async beforeRun(extraArgs: string[], ignoreIfNotFound: boolean): Promise<boolean> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        if (!existsSync(dockerFile)) {
            if (ignoreIfNotFound) {
                this.logger.info(`Docker compose ${dockerFile} does not exist, ignoring: docker-compose ${args.join(' ')}`);
                return false;
            } else {
                throw new Error(`Docker compose ${dockerFile} does not exist. Cannot run: docker-compose ${args.join(' ')}`);
            }
        }

        //Creating folders to avoid being created using sudo. Is there a better way?
        const dockerCompose: DockerCompose = await BootstrapUtils.loadYaml(dockerFile, false);
        if (!ignoreIfNotFound && this.params.pullImages) await this.pullImages(dockerCompose);

        const volumenList = _.flatMap(Object.values(dockerCompose?.services), (s) => s.volumes?.map((v) => v.split(':')[0]) || []) || [];

        await Promise.all(
            volumenList.map(async (v) => {
                const volumenPath = join(this.params.target, `docker`, v);
                if (!existsSync(volumenPath)) await BootstrapUtils.mkdir(volumenPath);
                if (v.startsWith('../databases') && OSUtils.isRoot()) {
                    this.logger.info(`Chmod 777 folder ${volumenPath}`);
                    chmodSync(volumenPath, '777');
                }
            }),
        );
        return true;
    }

    private async basicRun(extraArgs: string[]): Promise<string> {
        const dockerFile = join(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        return this.runtimeService.spawn('docker-compose', args, false);
    }

    private async pullImages(dockerCompose: DockerCompose) {
        const images = _.uniq(
            Object.values(dockerCompose.services)
                .map((s) => s.image)
                .filter((s) => s)
                .map((s) => s as string),
        );
        await Promise.all(images.map((image) => this.runtimeService.pullImage(image)));
    }
}
