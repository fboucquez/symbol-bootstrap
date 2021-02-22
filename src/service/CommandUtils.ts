/*
 * Copyright 2021 NEM
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
import { flags } from '@oclif/command';
import { IOptionFlag } from '@oclif/command/lib/flags';
import { prompt } from 'inquirer';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { BootstrapUtils } from './BootstrapUtils';
const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class CommandUtils {
    public static passwordPromptDefaultMessage = `Enter the password used to encrypt and decrypted custom presets, addresses.yml, and preset.yml files. When providing a password, private keys would be encrypted. Keep this password in a secure place!`;
    public static helpFlag = flags.help({ char: 'h', description: 'It shows the help of this command.' });

    public static targetFlag = flags.string({
        char: 't',
        description: 'The target folder where the symbol-bootstrap network is generated',
        default: BootstrapUtils.defaultTargetFolder,
    });

    public static passwordFlag = CommandUtils.getPasswordFlag(
        `A password used to encrypt and decrypted custom presets, addresses.yml, and preset.yml files. When providing a password, private keys would be encrypted. Keep this password in a secure place!`,
    );

    public static noPasswordFlag = flags.boolean({
        description: 'When provided, Bootstrap will not ask for a password',
        default: false,
    });

    public static getPasswordFlag(description: string): IOptionFlag<string | undefined> {
        return flags.string({
            description: description,
            hidden: true,
            parse(input: string): string {
                const result = !input || CommandUtils.isValidPassword(input);
                if (result === true) return input;
                throw new Error(`--password is invalid, ${result}`);
            },
        });
    }

    public static isValidPassword(input: string | undefined): boolean | string {
        if (!input || input === '') {
            return true;
        }
        if (input.length >= 4) return true;
        return `Password must have at least 4 characters but got ${input.length}`;
    }

    public static async resolvePassword(
        providedPassword: string | undefined,
        noPassword: boolean,
        message: string,
        log: boolean,
    ): Promise<string | undefined> {
        if (!providedPassword) {
            if (noPassword) {
                if (log) logger.warn(`Password has not been provided (--noPassword)! It's recommended to use one for security!`);
                return undefined;
            }
            const responses = await prompt([
                {
                    name: 'password',
                    mask: '*',
                    message: message,
                    type: 'password',
                    validate: CommandUtils.isValidPassword,
                },
            ]);
            if (responses.password === '' || !responses.password) {
                if (log) logger.warn(`Password has not been provided (empty text)! It's recommended to use one for security!`);
                return undefined;
            }
            if (log) logger.info(`Password has been provided`);
            return responses.password;
        }
        if (log) logger.info(`Password has been provided`);
        return providedPassword;
    }
}
