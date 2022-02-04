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

import { promises as fsPromises, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { dirname } from 'path';
import { CryptoUtils } from './CryptoUtils';
import { KnownError } from './KnownError';
import { Utils } from './Utils';

export type Password = string | false | undefined;

/**
 * Utility methods in charge of loading and saving yaml files (and text files).
 */
export class YamlUtils {
    public static isYmlFile(string: string): boolean {
        return string.toLowerCase().endsWith('.yml') || string.toLowerCase().endsWith('.yaml');
    }

    public static async writeYaml(path: string, object: unknown, password: Password): Promise<void> {
        const yamlString = this.toYaml(password ? CryptoUtils.encrypt(object, Utils.validatePassword(password)) : object);
        await this.writeTextFile(path, yamlString);
    }

    public static toYaml(object: unknown): string {
        return yaml.dump(object, { skipInvalid: true, indent: 4, lineWidth: 140, noRefs: true });
    }

    public static fromYaml(yamlString: string): any {
        return yaml.load(yamlString);
    }

    public static loadYaml(fileLocation: string, password: Password): any {
        const object = this.fromYaml(this.loadFileAsText(fileLocation));
        if (password) {
            Utils.validatePassword(password);
            try {
                return CryptoUtils.decrypt(object, password);
            } catch (e) {
                throw new KnownError(`Cannot decrypt file ${fileLocation}. Have you used the right password?`);
            }
        } else {
            if (password !== false && CryptoUtils.encryptedCount(object) > 0) {
                throw new KnownError(
                    `File ${fileLocation} seems to be encrypted but no password has been provided. Have you entered the right password?`,
                );
            }
        }
        return object;
    }

    public static async writeTextFile(path: string, text: string): Promise<void> {
        const mkdirParentFolder = async (fileName: string): Promise<void> => {
            const parentFolder = dirname(fileName);
            if (parentFolder) {
                await fsPromises.mkdir(parentFolder, { recursive: true });
            }
        };
        await mkdirParentFolder(path);
        await fsPromises.writeFile(path, text, 'utf8');
    }

    public static loadFileAsText(fileLocation: string): string {
        return readFileSync(fileLocation, 'utf8');
    }

    public static async readTextFile(path: string): Promise<string> {
        return fsPromises.readFile(path, 'utf8');
    }
}
