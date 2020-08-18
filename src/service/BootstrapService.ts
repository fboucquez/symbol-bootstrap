import { ConfigParams, ConfigResult, ConfigService } from './ConfigService';
import { ComposeParams, ComposeService } from './ComposeService';
import { RunParams, RunService } from './RunService';
import { BootstrapUtils } from './BootstrapUtils';

export type StartParams = ConfigParams & ComposeParams & RunParams;

/**
 * Main entry point for API integration.
 */
export class BootstrapService {
    public constructor(private readonly root: string = './node_modules/symbol-bootstrap') {
        //HOW TO RESOLVE THE ROOT FOLDER WHEN NOT USING OCLIF????
    }

    public async config(config: ConfigParams = ConfigService.defaultParams): Promise<ConfigResult> {
        return new ConfigService(this.root, config).run();
    }

    public async compose(config: ComposeParams = ComposeService.defaultParams): Promise<void> {
        await new ComposeService(this.root, config).run();
    }

    public async run(config: RunParams = RunService.defaultParams): Promise<void> {
        await new RunService(config).run();
    }

    public async start(config: StartParams): Promise<ConfigResult> {
        if (config.reset) {
            BootstrapUtils.deleteFolder(config.target);
        }

        const configResult = await new ConfigService(this.root, config).run();
        await new ComposeService(this.root, config).run(configResult.presetData);
        await new RunService(config).run();
        return configResult;
    }

    public async stop(config: RunParams = RunService.defaultParams): Promise<void> {
        await new RunService(config).stop();
    }
}
