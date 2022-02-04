/*
 * Copyright 2022 Fernando Boucquez
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
import { Logger } from '../logger';
import { Addresses, ConfigPreset, DockerCompose, DockerComposeService, DockerServicePreset } from '../model';
import { ConfigLoader } from './ConfigLoader';
import { Constants } from './Constants';
import { FileSystemService } from './FileSystemService';
import { HandlebarsUtils } from './HandlebarsUtils';
import { RemoteNodeService } from './RemoteNodeService';
import { RuntimeService } from './RuntimeService';
import { Utils } from './Utils';
import { Password, YamlUtils } from './YamlUtils';

export type ComposeParams = { target: string; user?: string; upgrade?: boolean; password?: Password; workingDir: string; offline: boolean };

const targetNodesFolder = Constants.targetNodesFolder;
const targetDatabasesFolder = Constants.targetDatabasesFolder;
const targetGatewaysFolder = Constants.targetGatewaysFolder;
const targetExplorersFolder = Constants.targetExplorersFolder;

export interface PortConfiguration {
    internalPort: number;
    openPort: number | undefined | boolean | string;
}

export class ComposeService {
    public static defaultParams: ComposeParams = {
        target: Constants.defaultTargetFolder,
        user: Constants.CURRENT_USER,
        workingDir: Constants.defaultWorkingDir,
        upgrade: false,
        offline: false,
    };

    public static readonly DEBUG_SERVICE_PARAMS = {
        security_opt: ['seccomp:unconfined'],
        cap_add: ['ALL'],
        privileged: true,
    };

    private readonly configLoader: ConfigLoader;
    private readonly fileSystemService: FileSystemService;

    constructor(private readonly logger: Logger, protected readonly params: ComposeParams) {
        this.configLoader = new ConfigLoader(logger);
        this.fileSystemService = new FileSystemService(logger);
    }

    public resolveDebugOptions(dockerComposeDebugMode: boolean, dockerComposeServiceDebugMode: boolean | undefined): any {
        if (dockerComposeServiceDebugMode == false) {
            return {};
        }
        if (dockerComposeServiceDebugMode || dockerComposeDebugMode) {
            return ComposeService.DEBUG_SERVICE_PARAMS;
        }
        return {};
    }

    public async run(passedPresetData?: ConfigPreset, passedAddresses?: Addresses): Promise<DockerCompose> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password || false);
        const remoteNodeService = new RemoteNodeService(this.logger, presetData, this.params.offline);
        const currentDir = process.cwd();
        const target = join(currentDir, this.params.target);
        const targetDocker = join(target, `docker`);
        if (this.params.upgrade) {
            this.fileSystemService.deleteFolder(targetDocker);
        }
        const dockerFile = join(targetDocker, 'docker-compose.yml');
        if (existsSync(dockerFile)) {
            this.logger.info(dockerFile + ' already exist. Reusing. (run --upgrade to drop and upgrade)');
            return YamlUtils.loadYaml(dockerFile, false);
        }

        await this.fileSystemService.mkdir(targetDocker);
        await HandlebarsUtils.generateConfiguration(presetData, join(Constants.ROOT_FOLDER, 'config', 'docker'), targetDocker);

        await this.fileSystemService.chmodRecursive(join(targetDocker, 'mongo'), 0o666);

        const user: string | undefined = await new RuntimeService(this.logger).resolveDockerUserFromParam(this.params.user);

        const vol = (hostFolder: string, imageFolder: string, readOnly: boolean): string => {
            return `${hostFolder}:${imageFolder}:${readOnly ? 'ro' : 'rw'}`;
        };

        this.logger.info(`Creating docker-compose.yml from last used profile.`);

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

        const resolveHttpsProxyDomains = (fromDomain: string, toDomain: string): string => {
            return `${fromDomain} -> ${toDomain}`;
        };

        const resolveService = async (
            servicePreset: DockerServicePreset,
            rawService: DockerComposeService,
        ): Promise<DockerComposeService> => {
            const service = { ...rawService };
            if (servicePreset.host || servicePreset.ipv4_address) {
                service.networks = { default: {} };
            }
            if (servicePreset.host) {
                service.hostname = servicePreset.host;
                service.networks!.default.aliases = [servicePreset.host];
            }
            if (servicePreset.ipv4_address) {
                service.networks!.default.ipv4_address = servicePreset.ipv4_address;
            }
            return _.merge({}, service, servicePreset.compose);
        };

        await Promise.all(
            (presetData.databases || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const databaseName = n.databaseName || presetData.databaseName;
                    const databasePort = 27017;
                    services.push(
                        await resolveService(n, {
                            user,
                            environment: { MONGO_INITDB_DATABASE: databaseName },
                            container_name: n.name,
                            image: presetData.mongoImage,
                            command: `mongod --dbpath=/dbdata --bind_ip=${n.name} ${presetData.mongoComposeRunParam}`,
                            stop_signal: 'SIGINT',
                            working_dir: '/docker-entrypoint-initdb.d',
                            ports: resolvePorts([{ internalPort: databasePort, openPort: n.openPort }]),
                            volumes: [
                                vol(`./mongo`, `/docker-entrypoint-initdb.d`, true),
                                vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata', false),
                            ],
                            ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                        }),
                    );
                }),
        );

        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        const restart = presetData.dockerComposeServiceRestart;
        await Promise.all(
            (presetData.nodes || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const debugFlag = 'DEBUG';
                    const serverDebugMode = presetData.dockerComposeDebugMode || n.dockerComposeDebugMode ? debugFlag : 'NORMAL';
                    const brokerDebugMode = presetData.dockerComposeDebugMode || n.brokerDockerComposeDebugMode ? debugFlag : 'NORMAL';
                    const serverCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${
                        presetData.dataDirectory
                    } server broker ${n.name} ${serverDebugMode} ${!!n.brokerName}`;
                    const brokerCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${
                        presetData.dataDirectory
                    } broker server ${n.brokerName || 'broker'} ${brokerDebugMode}`;
                    const portConfigurations = [{ internalPort: 7900, openPort: n.openPort }];

                    const serverDependsOn: string[] = [];
                    const brokerDependsOn: string[] = [];

                    if (n.databaseHost) {
                        serverDependsOn.push(n.databaseHost);
                        brokerDependsOn.push(n.databaseHost);
                    }
                    if (n.brokerName) {
                        serverDependsOn.push(n.brokerName);
                    }
                    const volumes = [
                        vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory, false),
                        vol(`./server`, nodeCommandsDirectory, true),
                    ];
                    const nodeService = await resolveService(n, {
                        user: serverDebugMode === debugFlag ? undefined : user, // if debug on, run as root
                        container_name: n.name,
                        image: presetData.symbolServerImage,
                        command: serverCommand,
                        stop_signal: 'SIGINT',
                        working_dir: nodeWorkingDirectory,
                        restart: restart,
                        ports: resolvePorts(portConfigurations),
                        volumes: volumes,
                        depends_on: serverDependsOn,
                        ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                    });

                    services.push(nodeService);
                    if (n.brokerName) {
                        services.push(
                            await resolveService(
                                {
                                    ipv4_address: n.brokerIpv4_address,
                                    openPort: n.brokerOpenPort,
                                    excludeDockerService: n.brokerExcludeDockerService,
                                    host: n.brokerHost,
                                    compose: n.brokerCompose,
                                },
                                {
                                    user: brokerDebugMode === debugFlag ? undefined : user, // if debug on, run as root
                                    container_name: n.brokerName,
                                    image: nodeService.image,
                                    working_dir: nodeWorkingDirectory,
                                    command: brokerCommand,
                                    ports: resolvePorts([{ internalPort: 7902, openPort: n.brokerOpenPort }]),
                                    stop_signal: 'SIGINT',
                                    restart: restart,
                                    volumes: nodeService.volumes,
                                    depends_on: brokerDependsOn,
                                    ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.brokerDockerComposeDebugMode),
                                },
                            ),
                        );
                    }
                }),
        );
        const restInternalPort = 3000; // Move to shared?
        await Promise.all(
            (presetData.gateways || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const volumes = [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory, false)];
                    services.push(
                        await resolveService(n, {
                            container_name: n.name,
                            user,
                            image: presetData.symbolRestImage,
                            command: 'npm start --prefix /app/catapult-rest/rest /symbol-workdir/rest.json',
                            stop_signal: 'SIGINT',
                            working_dir: nodeWorkingDirectory,
                            ports: resolvePorts([{ internalPort: restInternalPort, openPort: n.openPort }]),
                            restart: restart,
                            volumes: volumes,
                            depends_on: [n.databaseHost],
                            ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                        }),
                    );
                }),
        );

        await Promise.all(
            (presetData.httpsProxies || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const internalPort = 443;
                    const resolveHost = (): string => {
                        const host = n.host || presetData.nodes?.[0]?.host;
                        if (!host) {
                            throw new Error(
                                `HTTPS Proxy ${n.name} is invalid, 'host' property could not be resolved. It must be set to a valid DNS record.`,
                            );
                        }
                        return host;
                    };
                    const domains: string | undefined =
                        n.domains ||
                        presetData.gateways?.map((g) => resolveHttpsProxyDomains(resolveHost(), `http://${g.name}:${restInternalPort}`))[0];
                    if (!domains) {
                        throw new Error(`HTTPS Proxy ${n.name} is invalid, 'domains' property could not be resolved!`);
                    }
                    const restDependency = presetData.gateways?.[0]?.name;
                    services.push(
                        await resolveService(n, {
                            container_name: n.name,
                            image: presetData.httpsPortalImage,
                            stop_signal: 'SIGINT',
                            ports: resolvePorts([
                                { internalPort: 80, openPort: true },
                                { internalPort: internalPort, openPort: n.openPort },
                            ]),
                            environment: {
                                DOMAINS: domains,
                                WEBSOCKET: n.webSocket,
                                STAGE: n.stage,
                                SERVER_NAMES_HASH_BUCKET_SIZE: n.serverNamesHashBucketSize,
                            },
                            restart: restart,
                            depends_on: restDependency ? [restDependency] : [],
                            ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                        }),
                    );
                }),
        );

        await Promise.all(
            (presetData.explorers || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const volumes = [
                        vol(`../${targetExplorersFolder}/${n.name}`, nodeWorkingDirectory, true),
                        vol(`./explorer`, nodeCommandsDirectory, true),
                    ];
                    const entrypoint = `ash -c "/bin/ash ${nodeCommandsDirectory}/run.sh ${n.name}"`;
                    services.push(
                        await resolveService(n, {
                            container_name: n.name,
                            image: presetData.symbolExplorerImage,
                            entrypoint: entrypoint,
                            stop_signal: 'SIGINT',
                            working_dir: nodeWorkingDirectory,
                            ports: resolvePorts([{ internalPort: 4000, openPort: n.openPort }]),
                            restart: restart,
                            volumes: volumes,
                            ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                        }),
                    );
                }),
        );

        await Promise.all(
            (presetData.faucets || [])
                .filter((d) => !d.excludeDockerService)
                .map(async (n) => {
                    const mosaicPreset = presetData.nemesis.mosaics[0];
                    const fullName = `${presetData.baseNamespace}.${mosaicPreset.name}`;
                    const { defaultNode } = await remoteNodeService.resolveRestUrlsForServices();
                    services.push(
                        await resolveService(n, {
                            container_name: n.name,
                            image: presetData.symbolFaucetImage,
                            stop_signal: 'SIGINT',
                            environment: {
                                DEFAULT_NODE: defaultNode,
                                DEFAULT_NODE_CLIENT: defaultNode,
                                NATIVE_CURRENCY_NAME: fullName,
                                FAUCET_PRIVATE_KEY: this.getMainAccountPrivateKey(passedAddresses) || '',
                                NATIVE_CURRENCY_ID: HandlebarsUtils.toSimpleHex(presetData.currencyMosaicId || ''),
                            },
                            restart: restart,
                            ports: resolvePorts([{ internalPort: 4000, openPort: n.openPort }]),
                            depends_on: [n.gateway],
                            ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
                        }),
                    );
                }),
        );

        const validServices: DockerComposeService[] = services.filter((s) => s).map((s) => s as DockerComposeService);
        const servicesMap: Record<string, DockerComposeService> = _.keyBy(validServices, 'container_name');
        let dockerCompose: DockerCompose = {
            version: presetData.dockerComposeVersion,
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

        dockerCompose = Utils.pruneEmpty(_.merge({}, dockerCompose, presetData.compose));
        await YamlUtils.writeYaml(dockerFile, dockerCompose, undefined);
        this.logger.info(`The docker-compose.yml file created ${dockerFile}`);
        return dockerCompose;
    }

    private getMainAccountPrivateKey(passedAddresses: Addresses | undefined) {
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddressesIfPreset(this.params.target, this.params.password);
        return addresses?.mosaics?.[0]?.accounts[0].privateKey;
    }
}
