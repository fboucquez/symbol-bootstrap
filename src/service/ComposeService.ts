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

import * as _ from 'lodash';
import { join } from 'path';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { Addresses, ConfigPreset, DockerServicePreset } from '../model';
import { DockerCompose, DockerComposeService } from '../model/DockerCompose';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
export type ComposeParams = { target: string; user?: string; upgrade?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetNodesFolder = BootstrapUtils.targetNodesFolder;
const targetDatabasesFolder = BootstrapUtils.targetDatabasesFolder;
const targetGatewaysFolder = BootstrapUtils.targetGatewaysFolder;
const targetExplorersFolder = BootstrapUtils.targetExplorersFolder;
const targetWalletsFolder = BootstrapUtils.targetWalletsFolder;

export class ComposeService {
    public static defaultParams: ComposeParams = {
        target: BootstrapUtils.defaultTargetFolder,
        user: BootstrapUtils.CURRENT_USER,
        upgrade: false,
    };

    private readonly configLoader: ConfigLoader;

    constructor(private readonly root: string, protected readonly params: ComposeParams) {
        this.configLoader = new ConfigLoader();
    }

    public async run(passedPresetData?: ConfigPreset, passedAddresses?: Addresses): Promise<DockerCompose> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target);

        const currentDir = process.cwd();
        const target = join(currentDir, this.params.target);
        const targetDocker = join(target, `docker`);
        if (this.params.upgrade) {
            BootstrapUtils.deleteFolder(targetDocker);
        }
        const dockerFile = join(targetDocker, 'docker-compose.yml');
        if (fs.existsSync(dockerFile)) {
            logger.info(dockerFile + ' already exist. Reusing. (run --upgrade to drop and upgrade)');
            return BootstrapUtils.loadYaml(dockerFile);
        }

        await BootstrapUtils.mkdir(targetDocker);
        await BootstrapUtils.generateConfiguration(presetData, join(this.root, 'config', 'docker'), targetDocker);

        const user: string | undefined = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);

        const vol = (hostFolder: string, imageFolder: string, readOnly: boolean): string => {
            return `${hostFolder}:${imageFolder}:${readOnly ? 'ro' : 'rw'}`;
        };

        logger.info(`creating docker-compose.yml from last used profile.`);

        const services: (DockerComposeService | undefined)[] = [];

        const resolvePorts = (internalPort: number, openPort: number | undefined | boolean | string): string[] => {
            if (!openPort) {
                return [];
            }
            if (openPort === true || openPort === 'true') {
                return [`${internalPort}:${internalPort}`];
            }
            return [`${openPort}:${internalPort}`];
        };

        const resolveService = async (
            servicePreset: DockerServicePreset,
            rawService: DockerComposeService,
        ): Promise<DockerComposeService | undefined> => {
            if (servicePreset.excludeDockerService) {
                return undefined;
            }
            if (false) {
                // POC about creating custom aws images.
                const serviceName = rawService.container_name;
                const volumes = rawService.volumes || [];
                const image = rawService.image;
                const repository = 'nem-repository';
                const dockerfileContent = `FROM docker.io/${image}\n\n${volumes
                    .map((v) => {
                        const parts = v.split(':');
                        return `ADD ${parts[0].replace('../', '').replace('./', 'docker/')} ${parts[1]}`;
                    })
                    .join('\n')}\n`;
                const dockerFile = join(target, 'Dockerfile-' + serviceName);
                await BootstrapUtils.writeTextFile(dockerFile, dockerfileContent);
                await Promise.all(
                    volumes.map(async (v) => {
                        const parts = v.split(':');
                        await BootstrapUtils.mkdir(join(targetDocker, parts[0]));
                    }),
                );
                const generatedImageName = repository + ':' + serviceName;
                await BootstrapUtils.createImageUsingExec(target, dockerFile, generatedImageName);

                // const awsUserId = '172617417348';
                // aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 172617417348.dkr.ecr.us-east-1.amazonaws.com
                // const absoluteImageUrl = `${awsUserId}.dkr.ecr.us-east-1.amazonaws.com/${generatedImageName}`;
                // await BootstrapUtils.exec(`docker tag ${generatedImageName} ${absoluteImageUrl}`);

                return { ...rawService, image: generatedImageName, volumes: undefined };
            } else {
                const service = { ...rawService };
                if (servicePreset.host || servicePreset.ipv4_address) {
                    service.networks = { default: {} };
                }
                if (servicePreset.host) {
                    service.hostname = servicePreset.host;
                    service.networks!.default.aliases = [servicePreset.host];
                }
                if (servicePreset.environment) {
                    service.environment = { ...servicePreset.environment, ...rawService.environment };
                }
                if (servicePreset.ipv4_address) {
                    service.networks!.default.ipv4_address = servicePreset.ipv4_address;
                }
                return service;
            }
        };

        await Promise.all(
            (presetData.databases || []).map(async (n) => {
                services.push(
                    await resolveService(n, {
                        user,
                        environment: { MONGO_INITDB_DATABASE: n.databaseName || presetData.databaseName },
                        container_name: n.name,
                        image: presetData.mongoImage,
                        command: `mongod --dbpath=/dbdata --bind_ip=${n.name}`,
                        stop_signal: 'SIGINT',
                        working_dir: '/docker-entrypoint-initdb.d',
                        ports: resolvePorts(27017, n.openPort),
                        volumes: [
                            vol(`./mongo`, `/docker-entrypoint-initdb.d`, true),
                            vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata', false),
                        ],
                    }),
                );
            }),
        );

        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        await Promise.all(
            (presetData.nodes || []).map(async (n) => {
                const nodeService = await resolveService(n, {
                    user,
                    container_name: n.name,
                    image: presetData.symbolServerImage,
                    command: `bash -c "/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh  ${n.name} && /bin/bash ${nodeCommandsDirectory}/startServer.sh ${n.name}"`,
                    stop_signal: 'SIGINT',
                    working_dir: nodeWorkingDirectory,
                    restart: 'on-failure:2',
                    ports: resolvePorts(7900, n.openPort),
                    volumes: [
                        vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory, false),
                        vol(`./server`, nodeCommandsDirectory, true),
                    ],
                    depends_on: n.brokerName ? [n.brokerName] : [],
                });

                services.push(nodeService);
                if (n.brokerName && nodeService) {
                    services.push(
                        await resolveService(
                            {
                                ipv4_address: n.brokerIpv4_address,
                                openPort: n.brokerOpenPort,
                                excludeDockerService: n.brokerExcludeDockerService,
                                host: n.brokerHost,
                            },
                            {
                                user,
                                container_name: n.brokerName,
                                image: nodeService.image,
                                working_dir: nodeWorkingDirectory,
                                command: `bash -c "/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh ${n.brokerName} && /bin/bash ${nodeCommandsDirectory}/startBroker.sh ${n.brokerName}"`,
                                ports: resolvePorts(7902, n.brokerOpenPort),
                                stop_signal: 'SIGINT',
                                restart: 'on-failure:2',
                                volumes: nodeService.volumes,
                            },
                        ),
                    );
                }
            }),
        );

        await Promise.all(
            (presetData.gateways || []).map(async (n) => {
                services.push(
                    await resolveService(n, {
                        container_name: n.name,
                        user,
                        image: presetData.symbolRestImage,
                        command: 'npm start --prefix /app/catapult-rest/rest /symbol-workdir/rest.json',
                        stop_signal: 'SIGINT',
                        working_dir: nodeWorkingDirectory,
                        ports: resolvePorts(3000, n.openPort),
                        volumes: [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory, false)],
                        depends_on: [n.databaseHost],
                    }),
                );
            }),
        );

        await Promise.all(
            (presetData.wallets || []).map(async (n) => {
                services.push(
                    await resolveService(n, {
                        container_name: n.name,
                        image: presetData.symbolWalletImage,
                        stop_signal: 'SIGINT',
                        working_dir: nodeWorkingDirectory,
                        ports: resolvePorts(80, n.openPort),
                        restart: 'on-failure:2',
                        volumes: [vol(`../${targetWalletsFolder}/${n.name}`, '/usr/share/nginx/html/config', true)],
                    }),
                );
            }),
        );

        await Promise.all(
            (presetData.explorers || []).map(async (n) => {
                services.push(
                    await resolveService(n, {
                        container_name: n.name,
                        image: presetData.symbolExplorerImage,
                        command: `ash -c "/bin/ash ${nodeCommandsDirectory}/run.sh ${n.name}"`,
                        stop_signal: 'SIGINT',
                        working_dir: nodeWorkingDirectory,
                        ports: resolvePorts(80, n.openPort),
                        restart: 'on-failure:2',
                        volumes: [
                            vol(`../${targetExplorersFolder}/${n.name}`, nodeWorkingDirectory, true),
                            vol(`./explorer`, nodeCommandsDirectory, true),
                        ],
                    }),
                );
            }),
        );

        await Promise.all(
            (presetData.faucets || []).map(async (n) => {
                // const nemesisPrivateKey = addresses?.mosaics?[0]?/;
                services.push(
                    await resolveService(n, {
                        container_name: n.name,
                        image: presetData.symbolFaucetImage,
                        stop_signal: 'SIGINT',
                        environment: {
                            FAUCET_PRIVATE_KEY: n.environment?.FAUCET_PRIVATE_KEY || addresses?.mosaics?.[0]?.accounts[0].privateKey || '',
                            NATIVE_CURRENCY_ID: BootstrapUtils.toSimpleHex(
                                n.environment?.NATIVE_CURRENCY_ID || presetData.currencyMosaicId || '',
                            ),
                        },
                        restart: 'on-failure:2',
                        ports: resolvePorts(4000, n.openPort),
                        depends_on: [n.gateway],
                    }),
                );
            }),
        );

        const validServices: DockerComposeService[] = services.filter((s) => s).map((s) => s as DockerComposeService);
        const servicesMap: Record<string, DockerComposeService> = _.keyBy(validServices, 'container_name');
        const dockerCompose: DockerCompose = {
            version: '3',
            services: servicesMap,
        };

        if (presetData.subnet)
            dockerCompose.networks = {
                default: {
                    ipam: {
                        config: [
                            {
                                subnet: presetData.subnet,
                            },
                        ],
                    },
                },
            };

        await BootstrapUtils.writeYaml(dockerFile, dockerCompose);
        logger.info(`docker-compose.yml file created ${dockerFile}`);
        return dockerCompose;
    }
}
