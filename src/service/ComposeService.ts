import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset, DockerServicePreset } from '../model';
import * as _ from 'lodash';
import { join } from 'path';
import { DockerCompose, DockerComposeService } from '../model/DockerCompose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
export type ComposeParams = { target: string; user?: string; reset?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetNodesFolder = BootstrapUtils.targetNodesFolder;
const targetDatabasesFolder = BootstrapUtils.targetDatabasesFolder;
const targetGatewaysFolder = BootstrapUtils.targetGatewaysFolder;

export class ComposeService {
    public static defaultParams: ComposeParams = {
        target: BootstrapUtils.defaultTargetFolder,
        user: BootstrapUtils.CURRENT_USER,
        reset: false,
    };

    constructor(private readonly root: string, protected readonly params: ComposeParams) {}

    public async run(passedPresetData?: ConfigPreset): Promise<DockerCompose> {
        const presetData = passedPresetData ?? BootstrapUtils.loadExistingPresetData(this.params.target);

        const currentDir = process.cwd();
        const target = join(currentDir, this.params.target);
        const targetDocker = join(target, `docker`);
        if (this.params.reset) {
            BootstrapUtils.deleteFolder(targetDocker);
        }
        const dockerFile = join(targetDocker, 'docker-compose.yml');
        if (fs.existsSync(dockerFile)) {
            logger.info(dockerFile + ' already exist. Reusing. (run -r to reset)');
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
                const service = { ...rawService, user };
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
                return service;
            }
        };

        await Promise.all(
            (presetData.databases || []).map(async (n) => {
                services.push(
                    await resolveService(n, {
                        container_name: n.name,
                        image: presetData.mongoImage,
                        command: `bash -c "/bin/bash /userconfig/mongors.sh ${n.name} & mongod --dbpath=/dbdata --bind_ip=${n.name}"`,
                        stop_signal: 'SIGINT',
                        ports: resolvePorts(27017, n.openPort),
                        volumes: [vol(`./mongo`, `/userconfig/:ro`), vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata:rw')],
                    }),
                );
            }),
        );

        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        await Promise.all(
            (presetData.nodes || []).map(async (n) => {
                const nodeService = await resolveService(n, {
                    container_name: n.name,
                    image: presetData.symbolServerImage,
                    command: `bash -c "/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh  ${n.name} && /bin/bash ${nodeCommandsDirectory}/startServer.sh ${n.name}"`,
                    stop_signal: 'SIGINT',
                    working_dir: nodeWorkingDirectory,
                    restart: 'on-failure:2',
                    ports: resolvePorts(7900, n.openPort),
                    volumes: [vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory), vol(`./server`, nodeCommandsDirectory)],
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
                        image: presetData.symbolRestImage,
                        command: 'npm start --prefix /app/catapult-rest/rest /symbol-workdir/rest.json',
                        stop_signal: 'SIGINT',
                        working_dir: nodeWorkingDirectory,
                        ports: resolvePorts(3000, n.openPort),
                        volumes: [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory)],
                        depends_on: [n.databaseHost],
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
