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

import * as StreamZip from 'node-stream-zip';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { BootstrapUtils } from './BootstrapUtils';

const logger: Logger = LoggerFactory.getLogger(LogType.System);
export class ZipUtils {
    public static unzip(zipFile: string, innerFolder: string, targetFolder: string): Promise<void> {
        const zip = new StreamZip({
            file: zipFile,
            storeEntries: true,
        });
        logger.info(`Unzipping Backup Sync's '${innerFolder}' into '${targetFolder}'. This could take a while!`);
        let totalFiles = 0;
        let process = 0;
        return new Promise<void>((resolve, reject) => {
            zip.on('entry', (entry) => {
                if (!entry.isDirectory && totalFiles) {
                    process++;
                    const percentage = ((process * 100) / totalFiles).toFixed(2);
                    const message = `${percentage}% | ${process} files unzipped out of ${totalFiles}`;
                    BootstrapUtils.logSameLineMessage(message);
                }
                if (BootstrapUtils.stopProcess) {
                    zip.close();
                    console.log();
                    reject(new Error('Process cancelled!'));
                }
            });
            zip.on('ready', () => {
                totalFiles = zip.entriesCount;
                zip.extract(innerFolder, targetFolder, (err) => {
                    zip.close();
                    if (err) {
                        console.log();
                        reject(err);
                    } else {
                        console.log();
                        logger.info(`Unzipped '${targetFolder}' created`);
                        resolve();
                    }
                });
            });
        });
    }
}
