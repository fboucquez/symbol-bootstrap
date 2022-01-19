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

import { promises as fsPromises } from 'fs';
import * as Handlebars from 'handlebars';
import * as _ from 'lodash';
import { totalmem } from 'os';
import { basename, join } from 'path';
import { DtoMapping } from 'symbol-sdk';
import { Utils } from './Utils';
import { YamlUtils } from './YamlUtils';

export class HandlebarsUtils {
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
                            const template = await YamlUtils.readTextFile(fromPath);
                            const renderedTemplate = this.runTemplate(template, templateContext);

                            await fsPromises.writeFile(
                                destinationFile,
                                destinationFile.toLowerCase().endsWith('.json')
                                    ? HandlebarsUtils.formatJson(renderedTemplate)
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
            const securedMessage = Utils.secureString(Utils.getMessage(e));

            const message = `Unknown error rendering template. Error: ${securedMessage}\nTemplate:\n${securedTemplate}.`;
            throw new Error(`${message}\nContext: \n${securedContext}`);
        }
    }

    //HANDLEBARS READY FUNCTIONS:
    private static initialize = (() => {
        Handlebars.registerHelper('toAmount', HandlebarsUtils.toAmount);
        Handlebars.registerHelper('toHex', HandlebarsUtils.toHex);
        Handlebars.registerHelper('toSimpleHex', HandlebarsUtils.toSimpleHex);
        Handlebars.registerHelper('toSeconds', HandlebarsUtils.toSeconds);
        Handlebars.registerHelper('toJson', HandlebarsUtils.toJson);
        Handlebars.registerHelper('splitCsv', HandlebarsUtils.splitCsv);
        Handlebars.registerHelper('add', HandlebarsUtils.add);
        Handlebars.registerHelper('minus', HandlebarsUtils.minus);
        Handlebars.registerHelper('computerMemory', HandlebarsUtils.computerMemory);
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
        const numberAsString = HandlebarsUtils.toSimpleHex(renderedText);
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
            throw new Error(`${Utils.getMessage(e)}:JSON\n ${string}`);
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
}
