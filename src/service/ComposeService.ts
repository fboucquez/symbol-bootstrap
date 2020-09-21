import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';
import { join } from 'path';
import { DockerCompose, DockerComposeService } from '../model/DockerCompose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
export type ComposeParams = { target: string; user?: string; reset?: boolean };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ComposeService {
    public static defaultParams: ComposeParams = {
        target: 'target',
        user: BootstrapUtils.CURRENT_USER,
        reset: false,
    };

    constructor(private readonly root: string, protected readonly params: ComposeParams) {}

    public async run(passedPresetData?: ConfigPreset): Promise<void> {
        const presetData = passedPresetData ?? BootstrapUtils.loadExistingPresetData(this.params.target);

        const workingDir = process.cwd();
        const target = join(workingDir, this.params.target);
        const targetDocker = join(target, `docker`);
        if (this.params.reset) {
            BootstrapUtils.deleteFolder(targetDocker);
        }

        const dockerFile = join(targetDocker, 'docker-compose.yml');
        if (fs.existsSync(dockerFile)) {
            logger.info(dockerFile + ' already exist. Reusing. (run -r to reset)');
            return;
        }

        await BootstrapUtils.mkdir(join(this.params.target, 'state'));
        await BootstrapUtils.mkdir(targetDocker);
        await BootstrapUtils.generateConfiguration(presetData, join(this.root, 'config', 'docker'), targetDocker);

        const user: string | undefined = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);

        const vol = (hostFolder: string, imageFolder: string): string => {
            return hostFolder + ':' + imageFolder;
        };

        logger.info(`creating docker-compose.yml from last used profile.`);

        const services: Record<string, DockerComposeService> = {};

        (presetData.databases || []).forEach((n) => {
            services[n.name] = {
                image: presetData.mongoImage,
                user,
                command: `bash -c "mongod --dbpath=/dbdata --bind_ip=${n.name}"`,
                stop_signal: 'SIGINT',
                ports: n.openPort ? ['27017:27017'] : [],
                volumes: [vol('../data/mongo', '/dbdata:rw')],
            };

            services[n.name + '-init'] = {
                image: presetData.mongoImage,
                user,
                command: 'bash -c "/bin/bash /userconfig/mongors.sh && touch /state/mongo-is-setup"',
                volumes: [vol(`./mongo`, `/userconfig/:ro`), vol('../data/mongo', '/dbdata:rw'), vol('../state', '/state')],
                depends_on: [n.name],
            };
        });

        (presetData.nodes || []).forEach((n) => {
            const nodeService = {
                image: presetData.symbolServerImage,
                user,
                command: `bash -c "/bin/bash /userconfig/runServerRecover.sh  ${n.name} && /bin/bash /userconfig/startServer.sh ${n.name}"`,
                stop_signal: 'SIGINT',
                depends_on: [] as string[],
                restart: 'on-failure:2',
                ports: n.openBrokerPort ? ['7900:7900'] : [],
                volumes: [
                    vol(`./dockerfiles/catapult/userconfig/`, `/userconfig`),
                    vol(`./bin/bash`, `/bin-mount`),
                    vol(`../config/${n.name}/resources/`, `/userconfig/resources/`),
                    vol('../data/' + n.name, '/data:rw'),
                    vol('../data/nemesis-data', '/nemesis-data:rw'),
                    vol('../state', '/state'),
                ],
            };
            if (n.databaseHost) {
                nodeService.depends_on.push(n.databaseHost + '-init');
            }
            services[n.name] = nodeService;
            if (n.brokerHost) {
                services[n.brokerHost] = {
                    image: presetData.symbolServerImage,
                    user,
                    command: `bash -c "/bin/bash /userconfig/runServerRecover.sh ${n.brokerHost} && /bin/bash /userconfig/startBroker.sh ${n.brokerHost}"`,
                    stop_signal: 'SIGINT',
                    ports: n.openBrokerPort ? ['7902:7902'] : [],
                    restart: 'on-failure:2',
                    volumes: [
                        vol(`./dockerfiles/catapult/userconfig/`, `/userconfig`),
                        vol(`./bin/bash`, `/bin-mount`),
                        vol(`../config/${n.name}/resources/`, `/userconfig/resources/`),
                        vol('../data/' + n.name, '/data:rw'),
                        vol('../state', '/state'),
                    ],
                };
                nodeService.depends_on.push(n.brokerHost);
            }
        });

        (presetData.gateways || []).forEach((n) => {
            services[n.name] = {
                image: presetData.symbolRestImage,
                user,
                command: 'ash -c "npm start /userconfig/rest.json"',
                stop_signal: 'SIGINT',
                ports: n.openPort ? ['3000:3000'] : [],
                volumes: [
                    vol(`./bin/ash`, `/bin-mount`),
                    vol(`../config/${n.name}/`, `/userconfig/`),
                    vol('../state', '/state'),
                    vol(`../data/${n.apiNodeHost}`, `/logs:rw`),
                    vol(`../config/${n.apiNodeHost}/resources/`, `/usr/local/share/symbol/api-node-config/`),
                ],
                depends_on: [n.databaseHost + '-init'],
                networks: {
                    default: {
                        ipv4_address: '172.20.0.25',
                    },
                },
            };
        });

        const dockerCompose: DockerCompose = {
            version: '3',
            networks: {
                default: {
                    ipam: {
                        config: [
                            {
                                subnet: '172.20.0.0/24',
                            },
                        ],
                    },
                },
            },
            services: services,
        };

        await BootstrapUtils.writeYaml(dockerFile, dockerCompose);
        logger.info(`docker-compose.yml file created ${dockerFile}`);
    }
}
