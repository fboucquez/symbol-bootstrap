import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';

type ComposeParams = { target: string; root: string; user?: string };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ComposeService {
    constructor(protected readonly params: ComposeParams) {}

    public async run(): Promise<void> {
        const presetData = BootstrapUtils.loadExistingPresetData(this.params.target);

        const workingDir = `${process.cwd()}`;
        const target = `${workingDir}/${this.params.target}`;
        const targetDocker = `${target}/docker/`;
        await BootstrapUtils.mkdir(`${this.params.target}/state`);
        await BootstrapUtils.mkdir(targetDocker);
        await BootstrapUtils.generateConfiguration(presetData, `${this.params.root}/config/docker`, targetDocker);

        const user: string | undefined = this.params.user === 'current' ? await BootstrapUtils.getDockerUserGroup() : this.params.user;

        const vol = (hostFolder: string, imageFolder: string): string => {
            const targetFolder = `${targetDocker}${hostFolder}`;
            BootstrapUtils.mkdir(targetFolder);
            return hostFolder + ':' + imageFolder;
        };

        logger.info(`creating docker-compose.yml from last used profile.`);

        const services: Record<string, any> = {};

        (presetData.databases || []).forEach((n) => {
            const databaseService = {
                image: presetData.mongoImage,
                user,
                command: `bash -c "mongod --dbpath=/dbdata --bind_ip=${n.name}"`,
                stop_signal: 'SIGINT',
                ports: n.openPort ? ['27017:27017'] : [],
                volumes: [vol('../data/mongo', '/dbdata:rw')],
            };
            services[n.name] = databaseService;

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
                build: `dockerfiles/catapult`,
                user,
                command: `bash -c "/bin/bash /userconfig/runServerRecover.sh  ${n.name} && /bin/bash /userconfig/startServer.sh ${n.name}"`,
                stop_signal: 'SIGINT',
                depends_on: [] as string[],
                restart: 'on-failure:2',
                ports: n.openBrokerPort ? ['7900:7900'] : [],
                volumes: [
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
                    build: `dockerfiles/catapult`,
                    user,
                    command: `bash -c "/bin/bash /userconfig/runServerRecover.sh ${n.brokerHost} && /bin/bash /userconfig/startBroker.sh ${n.brokerHost}"`,
                    stop_signal: 'SIGINT',
                    ports: n.openBrokerPort ? ['7902:7902'] : [],
                    restart: 'on-failure:2',
                    volumes: [
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
                        ipv4_address: '172.20.0.10',
                    },
                },
            };
        });

        const dockerCompose = {
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

        const dockerFile = `${target}/docker/docker-compose.yml`;
        await BootstrapUtils.writeYaml(dockerFile, dockerCompose);
        logger.info(`docker-compose.yml file created ${dockerFile}`);
    }
}
