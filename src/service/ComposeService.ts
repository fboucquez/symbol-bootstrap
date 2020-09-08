import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';
import { join } from 'path';
import { DockerCompose, DockerComposeService } from '../model/DockerCompose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
export type ComposeParams = { target: string; user?: string; reset?: boolean; aws?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

const targetNodesFolder = BootstrapUtils.targetNodesFolder;
const targetDatabasesFolder = BootstrapUtils.targetDatabasesFolder;
const targetGatewaysFolder = BootstrapUtils.targetGatewaysFolder;

export class ComposeService {
    public static defaultParams: ComposeParams = {
        target: 'target',
        user: BootstrapUtils.CURRENT_USER,
        reset: false,
        aws: false,
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

        const services: Record<string, DockerComposeService> = {};

        const resolvePorts = (internalPort: number, openPort: number | undefined | boolean | string): string[] => {
            if (!openPort) {
                return [];
            }
            if (openPort === true || openPort === 'true') {
                return [`${internalPort}:${internalPort}`];
            }
            return [`${openPort}:${internalPort}`];
        };

        const resolveService = async (rawService: DockerComposeService): Promise<DockerComposeService> => {
            if (this.params.aws) {
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
                return { ...rawService, user };
            }
        };

        await Promise.all(
            (presetData.databases || []).map(async (n) => {
                services[n.name] = await resolveService({
                    container_name: n.name,
                    image: presetData.mongoImage,
                    command: `bash -c "/bin/bash /userconfig/mongors.sh ${n.name} & mongod --dbpath=/dbdata --bind_ip=${n.name}"`,
                    stop_signal: 'SIGINT',
                    ports: resolvePorts(27017, n.openPort),
                    volumes: [vol(`./mongo`, `/userconfig/:ro`), vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata:rw')],
                });
            }),
        );

        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        await Promise.all(
            (presetData.nodes || []).map(async (n) => {
                const nodeService = await resolveService({
                    container_name: n.name,
                    image: presetData.symbolServerImage,
                    command: `bash -c "/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh  ${n.name} && /bin/bash ${nodeCommandsDirectory}/startServer.sh ${n.name}"`,
                    stop_signal: 'SIGINT',
                    working_dir: nodeWorkingDirectory,
                    restart: 'on-failure:2',
                    ports: resolvePorts(7900, n.openPort),
                    volumes: [vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory), vol(`./server`, nodeCommandsDirectory)],
                });

                nodeService.depends_on = [];
                if (n.host) {
                    nodeService.hostname = n.host;
                    nodeService.networks = { default: { aliases: [n.host] } };
                }

                services[n.name] = nodeService;
                if (n.brokerHost) {
                    services[n.brokerHost] = await resolveService({
                        container_name: n.brokerHost,
                        image: nodeService.image,
                        working_dir: nodeWorkingDirectory,
                        command: `bash -c "/bin/bash ${nodeCommandsDirectory}/runServerRecover.sh ${n.brokerHost} && /bin/bash ${nodeCommandsDirectory}/startBroker.sh ${n.brokerHost}"`,
                        ports: resolvePorts(7902, n.openBrokerPort),
                        stop_signal: 'SIGINT',
                        restart: 'on-failure:2',
                        volumes: nodeService.volumes,
                    });
                    nodeService.depends_on.push(n.brokerHost);
                }
            }),
        );

        await Promise.all(
            (presetData.gateways || []).map(async (n) => {
                const gatewayService = await resolveService({
                    container_name: n.name,
                    image: presetData.symbolRestImage,
                    command: 'npm start --prefix /app/catapult-rest/rest /symbol-workdir/rest.json',
                    stop_signal: 'SIGINT',
                    working_dir: nodeWorkingDirectory,
                    ports: resolvePorts(3000, n.openPort),
                    volumes: [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory)],
                    depends_on: [n.databaseHost],
                });
                if (n.ipv4_address) {
                    gatewayService.networks = {
                        default: {
                            ipv4_address: n.ipv4_address,
                        },
                    };
                }
                services[n.name] = gatewayService;
            }),
        );

        const dockerCompose: DockerCompose = {
            version: '3',
            services: services,
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
