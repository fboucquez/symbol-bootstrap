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

import { Command, flags } from '@oclif/command';
import { existsSync } from 'fs';
import { prompt } from 'inquirer';
import { dirname, join } from 'path';
import { BootstrapService, BootstrapUtils, CommandUtils, CryptoUtils, LoggerFactory, LogType, ZipItem, ZipUtils } from '../';
import Clean from './clean';
import Compose from './compose';
import Config from './config';

export default class Pack extends Command {
    static description = 'It configures and packages your node into a zip file that can be uploaded to the final node machine.';

    static examples = [
        `$ symbol-bootstrap pack`,
        `$ symbol-bootstrap pack -c custom-preset.yml`,
        `$ symbol-bootstrap pack -p testnet -a dual -c custom-preset.yml`,
        `$ symbol-bootstrap pack -p mainnet -a dual --password 1234 -c custom-preset.yml`,
        `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap pack -c custom-preset.yml`,
    ];

    static flags = {
        ...Compose.flags,
        ...Clean.flags,
        ...Config.flags,
        ready: flags.boolean({
            description: 'If --ready is provided, the command will not ask offline confirmation.',
        }),
        logger: CommandUtils.getLoggerFlag(LogType.Console),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Pack);
        CommandUtils.showBanner();
        const logger = LoggerFactory.getLogger(flags.logger);
        const targetZip = join(dirname(flags.target), `symbol-node.zip`);

        if (existsSync(targetZip)) {
            throw new Error(
                `The target zip file ${targetZip} already exist. Do you want to delete it before repackaging your target folder?`,
            );
        }
        logger.info('');
        logger.info('');
        if (
            !flags.ready &&
            !(
                await prompt([
                    {
                        name: 'offlineNow',
                        message: `Symbol Bootstrap is about to start working with sensitive information (certificates and voting file generation) so it is highly recommended that you disconnect from the network before continuing. Say YES if you are offline or if you don't care.`,
                        type: 'confirm',
                        default: true,
                    },
                ])
            ).offlineNow
        ) {
            logger.info('Come back when you are offline...');
            return;
        }

        flags.password = await CommandUtils.resolvePassword(
            logger,
            flags.password,
            flags.noPassword,
            CommandUtils.passwordPromptDefaultMessage,
            true,
        );
        const service = new BootstrapService(logger);
        const configOnlyCustomPresetFileName = 'config-only-custom-preset.yml';
        const configResult = await service.config({ ...flags, workingDir: BootstrapUtils.defaultWorkingDir });
        await service.compose(flags, configResult.presetData);

        const noPrivateKeyTempFile = 'custom-preset-temp.temp';

        if (flags.customPreset) {
            await BootstrapUtils.writeYaml(
                noPrivateKeyTempFile,
                CryptoUtils.removePrivateKeys(BootstrapUtils.loadYaml(flags.customPreset, flags.password)),
                flags.password,
            );
        } else {
            await BootstrapUtils.writeYaml(noPrivateKeyTempFile, {}, flags.password);
        }
        const zipItems: ZipItem[] = [
            {
                from: flags.target,
                to: 'target',
                directory: true,
            },
            {
                from: noPrivateKeyTempFile,
                to: configOnlyCustomPresetFileName,
                directory: false,
            },
        ];

        await new ZipUtils(logger).zip(targetZip, zipItems);
        await BootstrapUtils.deleteFile(noPrivateKeyTempFile);
        logger.info('');
        logger.info(`Zip file ${targetZip} has been created. You can unzip it in your node's machine and run:`);
        logger.info(`$ symbol-bootstrap start`);
    }
}
