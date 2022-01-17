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

import { promises as fsPromises, writeFileSync } from 'fs';
import * as Handlebars from 'handlebars';
import * as _ from 'lodash';
import { totalmem } from 'os';
import { basename, isAbsolute, join } from 'path';
import { Convert, DtoMapping, NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { Utils } from './Utils';
import { YamlUtils } from './YamlUtils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

export type Password = string | false | undefined;

export class KnownError extends Error {
    public readonly known = true;
}

/**
 * The operation to migrate the data.
 */
export interface Migration {
    readonly description: string;

    migrate(from: any): any;
}

export class BootstrapUtils {
    public static stopProcess = false;

    private static onProcessListener = (() => {
        process.on('SIGINT', () => {
            BootstrapUtils.stopProcess = true;
        });
    })();

    public static sleep(ms: number): Promise<any> {
        // Create a promise that rejects in <ms> milliseconds
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                //@ts-ignore
                resolve();
            }, ms);
        });
    }

    public static poll(
        logger: Logger,
        promiseFunction: () => Promise<boolean>,
        totalPollingTime: number,
        pollIntervalMs: number,
    ): Promise<boolean> {
        const startTime = new Date().getMilliseconds();
        return promiseFunction().then(async (result) => {
            if (result) {
                return true;
            } else {
                if (BootstrapUtils.stopProcess) {
                    return Promise.resolve(false);
                }
                const endTime = new Date().getMilliseconds();
                const newPollingTime: number = Math.max(totalPollingTime - pollIntervalMs - (endTime - startTime), 0);
                if (newPollingTime) {
                    logger.info(`Retrying in ${pollIntervalMs / 1000} seconds. Polling will stop in ${newPollingTime / 1000} seconds`);
                    await BootstrapUtils.sleep(pollIntervalMs);
                    return this.poll(logger, promiseFunction, newPollingTime, pollIntervalMs);
                } else {
                    return false;
                }
            }
        });
    }

    public static async generateConfiguration(
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        templateContext: any,
        copyFrom: string,
        copyTo: string,
        excludeFiles: string[] = [],
        includeFiles: string[] = [],
    ): Promise<void> {
        // Loop through all the files in the config folder
        await fsPromises.mkdir(copyTo, { recursive: true });
        const files = await fsPromises.readdir(copyFrom);
        await Promise.all(
            files.map(async (file: string) => {
                const fromPath = join(copyFrom, file);
                const toPath = join(copyTo, file);

                // Stat the file to see if we have a file or dir
                const stat = await fsPromises.stat(fromPath);
                if (stat.isFile()) {
                    const isMustache = file.indexOf('.mustache') > -1;
                    const destinationFile = toPath.replace('.mustache', '');
                    const fileName = basename(destinationFile);
                    const notBlacklisted = excludeFiles.indexOf(fileName) === -1;
                    const inWhitelistIfAny = includeFiles.length === 0 || includeFiles.indexOf(fileName) > -1;
                    if (notBlacklisted && inWhitelistIfAny) {
                        if (isMustache) {
                            const template = await BootstrapUtils.readTextFile(fromPath);
                            const renderedTemplate = this.runTemplate(template, templateContext);

                            await fsPromises.writeFile(
                                destinationFile,
                                destinationFile.toLowerCase().endsWith('.json')
                                    ? BootstrapUtils.formatJson(renderedTemplate)
                                    : renderedTemplate,
                            );
                        } else {
                            await fsPromises.copyFile(fromPath, destinationFile);
                        }
                        await fsPromises.chmod(destinationFile, 0o600);
                    }
                } else if (stat.isDirectory()) {
                    await fsPromises.mkdir(toPath, { recursive: true });
                    await this.generateConfiguration(templateContext, fromPath, toPath, excludeFiles, includeFiles);
                }
            }),
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static runTemplate(template: string, templateContext: any): string {
        try {
            const compiledTemplate = Handlebars.compile(template);
            return compiledTemplate(templateContext);
        } catch (e) {
            const securedTemplate = Utils.secureString(template);
            const securedContext = Utils.secureString(YamlUtils.toYaml(templateContext));
            const securedMessage = Utils.secureString(e.message || 'Unknown');

            const message = `Unknown error rendering template. Error: ${securedMessage}\nTemplate:\n${securedTemplate}.`;
            throw new Error(`${message}\nContext: \n${securedContext}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static pruneEmpty(obj: any): any {
        return (function prune(current: any) {
            _.forOwn(current, (value, key) => {
                if (_.isUndefined(value) || _.isNull(value) || _.isNaN(value) || (_.isObject(value) && _.isEmpty(prune(value)))) {
                    delete current[key];
                }
            });
            // remove any leftover undefined values from the delete
            // operation on an array
            if (_.isArray(current)) _.pull(current, undefined);

            return current;
        })(_.cloneDeep(obj)); // Do not modify the original object, create a clone instead
    }

    //HANDLEBARS READY FUNCTIONS:
    private static initialize = (() => {
        Handlebars.registerHelper('toAmount', BootstrapUtils.toAmount);
        Handlebars.registerHelper('toHex', BootstrapUtils.toHex);
        Handlebars.registerHelper('toSimpleHex', BootstrapUtils.toSimpleHex);
        Handlebars.registerHelper('toSeconds', BootstrapUtils.toSeconds);
        Handlebars.registerHelper('toJson', BootstrapUtils.toJson);
        Handlebars.registerHelper('splitCsv', BootstrapUtils.splitCsv);
        Handlebars.registerHelper('add', BootstrapUtils.add);
        Handlebars.registerHelper('minus', BootstrapUtils.minus);
        Handlebars.registerHelper('computerMemory', BootstrapUtils.computerMemory);
    })();

    private static add(a: any, b: any): string | number {
        if (_.isNumber(a) && _.isNumber(b)) {
            return Number(a) + Number(b);
        }
        if (typeof a === 'string' && typeof b === 'string') {
            return a + b;
        }
        return '';
    }

    private static minus(a: any, b: any): number {
        if (!_.isNumber(a)) {
            throw new TypeError('expected the first argument to be a number');
        }
        if (!_.isNumber(b)) {
            throw new TypeError('expected the second argument to be a number');
        }
        return Number(a) - Number(b);
    }

    public static computerMemory(percentage: number): number {
        return (totalmem() * percentage) / 100;
    }

    public static toAmount(renderedText: string | number): string {
        const numberAsString = (renderedText + '').split("'").join('');
        if (!numberAsString.match(/^\d+$/)) {
            throw new Error(`'${renderedText}' is not a valid integer`);
        }
        return (numberAsString.match(/\d{1,3}(?=(\d{3})*$)/g) || [numberAsString]).join("'");
    }

    public static toHex(renderedText: string): string {
        if (!renderedText) {
            return '';
        }
        const numberAsString = BootstrapUtils.toSimpleHex(renderedText);
        return '0x' + (numberAsString.match(/\w{1,4}(?=(\w{4})*$)/g) || [numberAsString]).join("'");
    }

    public static toSimpleHex(renderedText: string): string {
        if (!renderedText) {
            return '';
        }
        return renderedText.toString().split("'").join('').replace(/^(0x)/, '');
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static toJson(object: any): string {
        return JSON.stringify(object, null, 2);
    }

    public static formatJson(string: string): string {
        // Validates and format the json string.
        try {
            return JSON.stringify(JSON.parse(string), null, 2);
        } catch (e) {
            throw new Error(`${e.message}:JSON\n ${string}`);
        }
    }

    public static splitCsv(object: string): string[] {
        return (object || '')
            .split(',')
            .map((string) => string.trim())
            .filter((string) => string);
    }

    public static toSeconds(serverDuration: string): number {
        return DtoMapping.parseServerDuration(serverDuration).seconds();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static migrate<T extends { version?: number }>(
        logger: Logger,
        entityName: string,
        versioned: T,
        migrations: Migration[] = [],
    ): T {
        if (!versioned) {
            return versioned;
        }
        const currentVersion = migrations.length + 1;
        versioned.version = versioned.version || 1;

        if (versioned.version == currentVersion) {
            return versioned;
        }
        logger.info(`Migrating object ${entityName} from version ${versioned.version} to version ${currentVersion}`);
        if (versioned.version > currentVersion) {
            throw new Error(`Current data version is ${versioned.version} but higher version is ${currentVersion}`);
        }
        const migratedVersioned = migrations.slice(versioned.version - 1).reduce((toMigrateData, migration) => {
            if (toMigrateData === undefined) {
                logger.info(`data to migrate is undefined, ignoring migration ${migration.description}`);
                return undefined;
            }
            logger.info(`Applying migration ${migration.description}`);
            return migration.migrate(toMigrateData);
        }, versioned);
        migratedVersioned.version = currentVersion;
        logger.info(`Object ${entityName} migrated to version ${currentVersion}`);
        return migratedVersioned;
    }

    public static getNetworkIdentifier(networkType: NetworkType): string {
        return BootstrapUtils.getNetworkName(networkType);
    }

    public static getNetworkName(networkType: NetworkType): string {
        switch (networkType) {
            case NetworkType.MAIN_NET:
                return 'mainnet';
            case NetworkType.TEST_NET:
                return 'testnet';
        }
        throw new Error(`Invalid Network Type ${networkType}`);
    }

    public static resolveWorkingDirPath(workingDir: string, path: string): string {
        if (isAbsolute(path)) {
            return path;
        } else {
            return join(workingDir, path);
        }
    }

    static createDerFile(privateKey: string, file: string): void {
        writeFileSync(file, Convert.hexToUint8(BootstrapUtils.toAns1(privateKey)));
    }
}
