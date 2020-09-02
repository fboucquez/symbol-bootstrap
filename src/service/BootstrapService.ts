import { ConfigParams, ConfigResult, ConfigService } from './ConfigService';
import { ComposeParams, ComposeService } from './ComposeService';
import { RunParams, RunService } from './RunService';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';

export type StartParams = ConfigParams & ComposeParams & RunParams;

/**
 * Main entry point for API integration.
 */
export class BootstrapService {
    public constructor(private readonly root: string = './node_modules/symbol-bootstrap') {}

    /**
     * It generates the configuration and nemesis for the provided preset
     *
     * @param config the params of the config command.
     */
    public async config(config: ConfigParams = ConfigService.defaultParams): Promise<ConfigResult> {
        return new ConfigService(this.root, config).run();
    }

    /**
     * It generates the docker-compose.yaml file from the previously generated configuration.
     *
     * The config method/command needs to be called before this method
     *
     * @param config the params of the compose command.
     * @param passedPresetData the created preset if you know if, otherwise will load the latest one resolved from the target folder.
     */
    public async compose(config: ComposeParams = ComposeService.defaultParams, passedPresetData?: ConfigPreset): Promise<void> {
        await new ComposeService(this.root, config).run(passedPresetData);
    }

    /**
     * It boots the network via docker using the generated docker-compose.yml file and configuration
     *
     * The config and compose methods/commands need to be called before this method.
     *
     * This is just a wrapper for docker-compose up bash call.
     *
     * @param config the params of the run command.
     */
    public async run(config: RunParams = RunService.defaultParams): Promise<void> {
        await new RunService(config).run();
    }

    /**
     * This method aggregates config, compose and run all in one.
     *
     * @param config the aggregated params in order to run all the sub commands.
     */
    public async start(config: StartParams): Promise<ConfigResult> {
        if (config.reset) {
            BootstrapUtils.deleteFolder(config.target);
        }
        const configResult = await this.config(config);
        await this.compose(config, configResult.presetData);
        await this.run(config);
        return configResult;
    }

    /**
     * It stops the docker-compose network if running.
     *
     * This is just a wrapper for docker-compose down bash call.
     *
     * @param config the params necessary to detect and stop the network.
     */
    public async stop(config: RunParams = RunService.defaultParams): Promise<void> {
        await new RunService(config).stop();
    }
}
