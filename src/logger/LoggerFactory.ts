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

import { join, resolve } from 'path';
import * as winston from 'winston';
import { FileTransportInstance } from 'winston/lib/winston/transports';
import { Constants } from '../service';
import { Logger } from './Logger';
import { LogType } from './LogType';

export class LoggerFactory {
    public static readonly separator = ',';
    private static readonly consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.cli(),
            winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`),
        ),
    });

    private static readonly silent = new winston.transports.Console({
        silent: true,
    });

    private static readonly fileTransport = (fileName: string): FileTransportInstance =>
        new winston.transports.File({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`),
            ),
            options: { flags: 'w' },
            filename: resolve(fileName),
            level: 'info',
        });

    public static getLogger(logTypes: string, workingDir = Constants.defaultWorkingDir): Logger {
        return this.getLoggerFromTypes(
            logTypes
                .split(LoggerFactory.separator)
                .map((l) => l.trim() as LogType)
                .filter((t) => t),
            workingDir,
        );
    }

    public static getLoggerFromTypes(logTypes: LogType[], workingDir = Constants.defaultWorkingDir): Logger {
        const id = logTypes.join(LoggerFactory.separator);
        if (!winston.loggers.has(id)) {
            const transports = logTypes.map((logType) => {
                switch (logType.toLowerCase()) {
                    case LogType.File.toLowerCase():
                        return LoggerFactory.fileTransport(join(workingDir, 'logs.log'));
                    case LogType.Console.toLowerCase():
                        return LoggerFactory.consoleTransport;
                    case LogType.Silent.toLowerCase():
                        return LoggerFactory.silent;
                    default:
                        throw new Error(`Unknown LogType ${logType}`);
                }
            });
            winston.loggers.add(id, {
                transports: transports,
                format: winston.format.label({ label: id }),
            });
        }
        return winston.loggers.get(id);
    }
}
