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

import { existsSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { ConfigPreset, DockerCompose, DockerComposeService } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';
export type ComposeParams = { target: string; user?: string; upgrade?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetNodesFolder = BootstrapUtils.targetNodesFolder;
const targetDatabasesFolder = BootstrapUtils.targetDatabasesFolder;
const targetGatewaysFolder = BootstrapUtils.targetGatewaysFolder;

export interface PortConfiguration {
    internalPort: number;
    openPort: number | undefined | boolean | string;
}

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

    public async run(passedPresetData?: ConfigPreset): Promise<DockerCompose> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target);

        const currentDir = process.cwd();
        const target = join(currentDir, this.params.target);
        const targetDocker = join(target, `docker`);
        if (this.params.upgrade) {
            BootstrapUtils.deleteFolder(targetDocker);
        }
        const dockerFile = join(targetDocker, 'docker-compose.yml');
        if (existsSync(dockerFile)) {
            logger.info(dockerFile + ' already exist. Reusing. (run --upgrade to drop and upgrade)');
            return BootstrapUtils.loadYaml(dockerFile);
        }

        await BootstrapUtils.mkdir(targetDocker);
        await BootstrapUtils.generateConfiguration(presetData, join(this.root, 'config', 'docker'), targetDocker);

        const user: string | undefined = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);

        const vol = (hostFolder: string, imageFolder: string): string => {
            return hostFolder + ':' + imageFolder;
        };

        logger.info(`creating docker-compose.yml from last used profile.`);

        const services: (DockerComposeService | undefined)[] = [];

        const resolvePorts = (portConfigurations: PortConfiguration[]): string[] => {
            return portConfigurations
                .filter((c) => c.openPort)
                .map(({ openPort, internalPort }) => {
                    if (openPort === true || openPort === 'true') {
                        return `${internalPort}:${internalPort}`;
                    }
                    return `${openPort}:${internalPort}`;
                });
        };

        const resolveService = async (rawService: DockerComposeService): Promise<DockerComposeService> => {
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
                return rawService;
            }
        };

        const restart = 'unless-stopped';
        await Promise.all(
            (presetData.databases || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const databaseName = n.databaseName || presetData.databaseName;
                    const databasePort = 27017;
                    services.push(
                        await resolveService({
                            user,
                            environment: { MONGO_INITDB_DATABASE: databaseName, ...n.environment },
                            container_name: n.name,
                            image: presetData.mongoImage,
                            hostname: n.host,
                            networks: {
                                default: {
                                    ipv4_address: n.ipv4_address,
                                    aliases: [n.host].filter((s) => s).map((s) => s as string),
                                },
                            },
                            // healthcheck: {
                            //     test: `echo 'db.runCommand("ping").ok' | mongo ${n.host || n.name}:${databasePort}/${databaseName} --quiet`,
                            //     interval: '30s',
                            //     timeout: '10s',
                            //     retries: 5,
                            //     start_period: '40s',
                            // },
                            restart: restart,
                            command: `mongod --dbpath=/dbdata --bind_ip=${n.name}`,
                            stop_signal: 'SIGINT',
                            working_dir: '/docker-entrypoint-initdb.d',
                            ports: resolvePorts([{ internalPort: databasePort, openPort: n.openPort }]),
                            volumes: [
                                vol(`./mongo`, `/docker-entrypoint-initdb.d/:ro`),
                                vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata:rw'),
                            ],
                        }),
                    );
                }),
        );

        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        await Promise.all(
            (presetData.nodes || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const nodeVolumes = [
                        vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory),
                        vol(`./server`, nodeCommandsDirectory),
                    ];
                    const recoverCommand = `/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh ${n.name}`;
                    const serverCommand = `/bin/bash ${nodeCommandsDirectory}/startServer.sh ${n.name}`;
                    const brokerCommand = `/bin/bash ${nodeCommandsDirectory}/startBroker.sh ${n.brokerName || ''}`;

                    if (presetData.sharedServerBrokerService) {
                        const portConfigurations = [{ internalPort: 7900, openPort: n.openPort }];
                        if (n.brokerName) {
                            portConfigurations.push({ internalPort: 7902, openPort: n.brokerOpenPort });
                        }
                        const commands = [recoverCommand];
                        commands.push(serverCommand);
                        if (n.brokerName) {
                            commands.push(brokerCommand);
                        }

                        // const portsToCheck = portConfigurations.filter((p) => p.openPort && p.internalPort).map((p) => p.internalPort);
                        // const healthChecks = portsToCheck.map((p) => `printf "GET / HTTP/1.1\\n\\n" > /dev/tcp/127.0.0.1/${p}`);

                        const aliases = _.uniq([n.name, n.host, n.brokerName, n.brokerHost].filter((s) => s).map((s) => s as string));
                        const nodeService = await resolveService({
                            user,
                            environment: n.environment,
                            container_name: n.name,
                            hostname: n.host || n.name,
                            networks: {
                                default: {
                                    ipv4_address: n.ipv4_address,
                                    aliases: aliases,
                                },
                            },

                            image: presetData.symbolServerImage,
                            command: `bash -c "${commands.join(' && ')}"`,
                            stop_signal: 'SIGINT',
                            working_dir: nodeWorkingDirectory,
                            restart: restart,
                            ports: resolvePorts(portConfigurations),
                            volumes: nodeVolumes,
                            depends_on: [n.databaseHost].map((s) => s as string),
                        });
                        services.push(nodeService);
                    } else {
                        const alises = _.uniq([n.name, n.host].filter((s) => s).map((s) => s as string));
                        const nodeService = await resolveService({
                            user,
                            container_name: n.name,
                            hostname: n.host || n.name,
                            networks: {
                                default: {
                                    ipv4_address: n.ipv4_address,
                                    aliases: alises,
                                },
                            },
                            // healthcheck: healthChecks.length
                            //     ? {
                            //           test: healthChecks.join(' & '),
                            //           interval: '30s',
                            //           timeout: '10s',
                            //           retries: 5,
                            //           start_period: '40s',
                            //       }
                            //     : undefined,

                            image: presetData.symbolServerImage,
                            working_dir: nodeWorkingDirectory,
                            command: `bash -c "${[recoverCommand, serverCommand].join(' && ')}"`,
                            stop_signal: 'SIGINT',
                            restart: restart,
                            ports: resolvePorts([{ internalPort: 7900, openPort: n.openPort }]),
                            volumes: [
                                vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory),
                                vol(`./server`, nodeCommandsDirectory),
                            ],
                            depends_on: [n.databaseHost].map((s) => s as string),
                        });

                        services.push(nodeService);
                        if (n.brokerName && nodeService && !n.brokerExcludeDockerService) {
                            const brokerAliases = _.uniq([n.brokerName, n.brokerHost].filter((s) => s).map((s) => s as string));
                            services.push(
                                await resolveService({
                                    user,
                                    container_name: n.brokerName,
                                    hostname: n.brokerHost || n.brokerName,
                                    networks: {
                                        default: {
                                            ipv4_address: n.brokerIpv4_address,
                                            aliases: brokerAliases,
                                        },
                                    },
                                    image: nodeService.image,
                                    working_dir: nodeWorkingDirectory,
                                    command: brokerCommand,
                                    ports: resolvePorts([{ internalPort: 7902, openPort: n.brokerOpenPort }]),
                                    stop_signal: 'SIGINT',
                                    restart: 'on-failure:2',
                                    volumes: nodeService.volumes,
                                    depends_on: [n.databaseHost, nodeService.container_name].map((s) => s as string),
                                }),
                            );
                        }
                    }
                }),
        );

        await Promise.all(
            (presetData.gateways || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const internalPort = 3000;
                    services.push(
                        await resolveService({
                            container_name: n.name,
                            user,
                            hostname: n.host,
                            networks: {
                                default: {
                                    ipv4_address: n.ipv4_address,
                                    aliases: [n.host].filter((s) => s).map((s) => s as string),
                                },
                            },

                            // healthcheck: {
                            //     test: `wget --no-verbose --tries=1 --spider http://localhost:${internalPort}/node/health || exit 1`,
                            //     interval: '30s',
                            //     timeout: '10s',
                            //     retries: 5,
                            //     start_period: '40s',
                            // },
                            environment: n.environment,
                            image: presetData.symbolRestImage,
                            working_dir: nodeWorkingDirectory,
                            command: 'npm start --prefix /app/catapult-rest/rest /symbol-workdir/rest.json',
                            stop_signal: 'SIGINT',
                            restart: restart,
                            ports: resolvePorts([{ internalPort: internalPort, openPort: n.openPort }]),
                            volumes: [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory)],
                            depends_on: [n.databaseHost, n.apiNodeName],
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
